import { useCallback } from 'react'
import { base44 } from '@/api/base44Client'

export function useDuplicateCheck() {
  const checkDuplicates = useCallback(async ({ entity_type, email, phone, mobile, first_name, last_name, birthdate }) => {
    try {
      const result = await base44.functions.invoke('detectDuplicates', {
        entity_type,
        email,
        phone,
        mobile,
        first_name,
        last_name,
        birthdate,
      })
      return result.data
    } catch {
      // Silently fail — don't block user on duplicate check error
      return { duplicates: [], warning: false }
    }
  }, [])

  const logError = useCallback(async ({ error_type, entity_type, entity_id, error_message, function_name }) => {
    try {
      await base44.functions.invoke('logError', {
        error_type,
        entity_type,
        entity_id,
        error_message,
        function_name,
      })
    } catch {
      // Silent — log failures should never break user workflow
    }
  }, [])

  const createAudit = useCallback(async ({ entity_type, entity_id, action, old_values, new_values, summary }) => {
    try {
      await base44.functions.invoke('createAuditLog', {
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        summary,
      })
    } catch {
      // Silent — audit failures should not block workflow
    }
  }, [])

  return { checkDuplicates, logError, createAudit }
}