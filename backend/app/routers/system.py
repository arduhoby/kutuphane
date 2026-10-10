import asyncio
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_user_from_token
from app.config import settings

router = APIRouter(prefix="/system", tags=["system"])

@router.get("/backup")
async def backup_database(
    token: str | None = Query(None),
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
):
    bearer = token
    if not bearer and authorization and authorization.startswith("Bearer "):
        bearer = authorization[7:]
    if not bearer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    current_user = await get_user_from_token(bearer, db)

    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Sadece adminler veritabanı yedeği alabilir.")

    # pg_dump requires standard postgresql URL
    db_url = settings.DATABASE_URL.replace("+asyncpg", "")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"kutuphane_backup_{timestamp}.sql"
    backup_filepath = f"/tmp/{backup_filename}"
    
    # Run pg_dump
    process = await asyncio.create_subprocess_exec(
        "pg_dump", 
        db_url, 
        "-F", "p", # plain text SQL
        "-f", backup_filepath,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        error_msg = stderr.decode()
        raise HTTPException(status_code=500, detail=f"Yedekleme başarısız oldu: {error_msg}")
        
    if not os.path.exists(backup_filepath):
        raise HTTPException(status_code=500, detail="Yedekleme dosyası oluşturulamadı.")
        
    return FileResponse(
        path=backup_filepath, 
        filename=backup_filename, 
        media_type="application/sql"
    )
