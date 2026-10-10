import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api/client'

const DEFAULT_LIMIT = 50
const SORT_KEY = 'book_sort_preference'
const HOVER_CARD_KEY = 'hover_card_enabled'

export function getDefaultSort(): string {
  if (typeof window === 'undefined') return 'created_desc'
  return localStorage.getItem(SORT_KEY) || 'created_desc'
}

export function setDefaultSort(sort: string): void {
  localStorage.setItem(SORT_KEY, sort)
}

export const SORT_OPTIONS = [
  { value: 'created_desc', label: 'Son Giren' },
  { value: 'created_asc', label: 'İlk Giren' },
  { value: 'title_asc', label: 'A-Z' },
  { value: 'title_desc', label: 'Z-A' },
]

export function getHoverCardEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const v = localStorage.getItem(HOVER_CARD_KEY)
  return v === null ? true : v === 'true'
}

export function setHoverCardEnabled(enabled: boolean): void {
  localStorage.setItem(HOVER_CARD_KEY, String(enabled))
}

export function useBookSearch(limit = DEFAULT_LIMIT) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<{ items: any[]; total: number }>({ items: [], total: 0 })
  const [loading, setLoading] = useState(true)

  // Single source of truth: URL search params
  const query = searchParams.get('query') || ''
  const page = Number(searchParams.get('page')) || 1
  const sort = searchParams.get('sort') || getDefaultSort()
  const isRead = searchParams.get('is_read') === 'true' ? true : searchParams.get('is_read') === 'false' ? false : undefined
  const isEbook = searchParams.get('is_ebook') === 'true' ? true : searchParams.get('is_ebook') === 'false' ? false : undefined
  const isPrinted = searchParams.get('is_printed') === 'true' ? true : searchParams.get('is_printed') === 'false' ? false : undefined
  const isLoaned = searchParams.get('is_loaned') === 'true' ? true : searchParams.get('is_loaned') === 'false' ? false : undefined

  const totalPages = Math.ceil(data.total / limit)

  // Setters update URL directly — no reactive effects, no mount resets
  const setQuery = (q: string) => {
    setSearchParams((prev) => {
      if (q) prev.set('query', q)
      else prev.delete('query')
      prev.delete('page')
      return prev
    })
  }

  const setPage = (p: number) => {
    setSearchParams((prev) => {
      if (p > 1) prev.set('page', String(p))
      else prev.delete('page')
      return prev
    })
  }

  const setIsRead = (v: boolean | undefined) => {
    setSearchParams((prev) => {
      if (v === true) prev.set('is_read', 'true')
      else if (v === false) prev.set('is_read', 'false')
      else prev.delete('is_read')
      prev.delete('page')
      return prev
    })
  }

  const setIsEbook = (v: boolean | undefined) => {
    setSearchParams((prev) => {
      if (v === true) prev.set('is_ebook', 'true')
      else if (v === false) prev.set('is_ebook', 'false')
      else prev.delete('is_ebook')
      prev.delete('page')
      return prev
    })
  }

  const setIsPrinted = (v: boolean | undefined) => {
    setSearchParams((prev) => {
      if (v === true) prev.set('is_printed', 'true')
      else if (v === false) prev.set('is_printed', 'false')
      else prev.delete('is_printed')
      prev.delete('page')
      return prev
    })
  }

  const setIsLoaned = (v: boolean | undefined) => {
    setSearchParams((prev) => {
      if (v === true) prev.set('is_loaned', 'true')
      else if (v === false) prev.set('is_loaned', 'false')
      else prev.delete('is_loaned')
      prev.delete('page')
      return prev
    })
  }

  const setSort = (s: string) => {
    const def = getDefaultSort()
    setSearchParams((prev) => {
      if (s && s !== def) prev.set('sort', s)
      else prev.delete('sort')
      prev.delete('page')
      return prev
    })
  }

  const fetchBooks = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { limit, skip: (page - 1) * limit, sort }
      if (query) params.query = query
      if (isRead !== undefined) params.is_read = isRead
      if (isEbook !== undefined) params.is_ebook = isEbook
      if (isPrinted !== undefined) params.is_printed = isPrinted
      if (isLoaned !== undefined) params.is_loaned = isLoaned
      const result = await api.books.list(params)
      setData(result)
    } catch {
      setData({ items: [], total: 0 })
    } finally {
      setLoading(false)
    }
  }, [query, page, sort, isRead, isEbook, isPrinted, isLoaned, limit])

  useEffect(() => {
    fetchBooks()
  }, [fetchBooks])

  const toggleFilter = (current: boolean | undefined): boolean | undefined => {
    if (current === undefined) return true
    if (current === true) return false
    return undefined
  }

  const clearSearch = () => {
    setSearchParams({})
  }

  const clearFilters = () => {
    setSearchParams((prev) => {
      prev.delete('is_read')
      prev.delete('is_ebook')
      prev.delete('is_printed')
      prev.delete('is_loaned')
      prev.delete('page')
      return prev
    })
  }

  const hasFilters = !!query || isRead !== undefined || isEbook !== undefined || isPrinted !== undefined || isLoaned !== undefined

  return {
    data: data.items,
    total: data.total,
    loading,
    query,
    page,
    totalPages,
    sort,
    isRead,
    isEbook,
    isPrinted,
    isLoaned,
    hasFilters,
    setQuery,
    setPage,
    setSort,
    setIsRead,
    setIsEbook,
    setIsPrinted,
    setIsLoaned,
    toggleFilter,
    clearSearch,
    clearFilters,
    fetchBooks,
  }
}
