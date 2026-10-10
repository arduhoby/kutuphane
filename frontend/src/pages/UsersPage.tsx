import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Users } from 'lucide-react'

export function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.users.list().then(setUsers).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kullanıcılar</h1>
        <p className="text-muted-foreground mt-1">Sistem kullanıcıları</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.id}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {u.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-base">{u.full_name || u.username}</CardTitle>
                  <p className="text-sm text-muted-foreground">@{u.username}</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{u.email}</p>
                <div className="flex gap-2 mt-2">
                  {u.is_admin && <Badge>Admin</Badge>}
                  {!u.is_active && <Badge variant="destructive">Pasif</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
