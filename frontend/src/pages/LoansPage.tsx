import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { BookMarked, CheckCircle, AlertTriangle } from 'lucide-react'
import { format, isPast, parseISO } from 'date-fns'

export function LoansPage() {
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeOnly, setActiveOnly] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  const fetchLoans = async () => {
    setLoading(true)
    try {
      const data = await api.loans.list({ active_only: activeOnly ? 'true' : undefined })
      setLoans(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLoans()
  }, [activeOnly])

  const handleReturn = async (loanId: number) => {
    try {
      await api.loans.return(loanId)
      toast({ title: 'Kitap geri alındı' })
      fetchLoans()
    } catch (err: any) {
      toast({ title: 'Hata', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ödünçler</h1>
          <p className="text-muted-foreground mt-1">Kitap ödünç takibi</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveOnly(true)}
          >
            Aktif
          </Button>
          <Button
            variant={!activeOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveOnly(false)}
          >
            Tümü
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : loans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BookMarked className="h-12 w-12 mb-4 opacity-50" />
            <p>Aktif ödünç bulunmuyor</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const overdue = !loan.returned_at && isPast(parseISO(loan.due_at))
            return (
              <Card key={loan.id} className={overdue ? 'border-red-300 dark:border-red-800' : ''}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`rounded-lg p-2 ${overdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary/10'}`}>
                    {overdue ? (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    ) : (
                      <BookMarked className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Kitap #{loan.book_id}</p>
                    <p className="text-sm text-muted-foreground">
                      Kullanıcı #{loan.user_id} -{' '}
                      {loan.borrowed_at && format(parseISO(loan.borrowed_at), 'dd.MM.yyyy')}
                      {' → '}
                      {loan.due_at && format(parseISO(loan.due_at), 'dd.MM.yyyy')}
                    </p>
                    <div className="flex gap-2 mt-1">
                      {overdue && <Badge variant="destructive">Gecikmiş</Badge>}
                      {loan.returned_at ? (
                        <Badge variant="success">Teslim Edildi</Badge>
                      ) : (
                        <Badge variant="warning">Aktif</Badge>
                      )}
                    </div>
                  </div>
                  {!loan.returned_at && user?.is_admin && (
                    <Button size="sm" variant="outline" onClick={() => handleReturn(loan.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Teslim Al
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
