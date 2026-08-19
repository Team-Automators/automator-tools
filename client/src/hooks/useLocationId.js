import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getLocationId, persistLocationId } from '../lib/api.js'

export function useLocationId() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const fromUrl = searchParams.get('locationId')
    if (fromUrl) persistLocationId(fromUrl)
  }, [searchParams])

  return getLocationId()
}
