import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook für echte Backend-basierte Zugriffskontrolle
 */
export function useAccessControl() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  // Prüfe Kundenzugriff über Backend-Funktion
  const checkCustomerAccess = async (customerId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    try {
      const result = await base44.functions.invoke('guardDataAccess', {
        entityType: 'Customer',
        entityId: customerId,
      });
      return result.data?.allowed || false;
    } catch {
      return false;
    }
  };

  // Prüfe Vertragszugriff über Backend-Funktion
  const checkContractAccess = async (contractId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    try {
      const result = await base44.functions.invoke('guardDataAccess', {
        entityType: 'Contract',
        entityId: contractId,
      });
      return result.data?.allowed || false;
    } catch {
      return false;
    }
  };

  // Prüfe Dokumentzugriff über Backend-Funktion
  const checkDocumentAccess = async (documentId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    try {
      const result = await base44.functions.invoke('guardDataAccess', {
        entityType: 'Document',
        entityId: documentId,
      });
      return result.data?.allowed || false;
    } catch {
      return false;
    }
  };

  // Hole sichtbare Kunden
  const { data: visibleCustomers = [] } = useQuery({
    queryKey: ['visibleCustomers', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      if (currentUser.role === 'admin') {
        return base44.asServiceRole.entities.Customer.list(null, 100);
      }
      const result = await base44.functions.invoke('getUserVisibleData', {
        entityType: 'Customer',
        limit: 5000,
      });
      return result.data?.data || [];
    },
    enabled: !!currentUser?.id,
  });

  // Hole sichtbare Verträge
  const { data: visibleContracts = [] } = useQuery({
    queryKey: ['visibleContracts', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      if (currentUser.role === 'admin') {
        return base44.asServiceRole.entities.Contract.list(null, 100);
      }
      const result = await base44.functions.invoke('getUserVisibleData', {
        entityType: 'Contract',
        limit: 5000,
      });
      return result.data?.data || [];
    },
    enabled: !!currentUser?.id,
  });

  const canEditAdvisor = () => {
    return currentUser?.role === 'admin';
  };

  return {
    currentUser,
    checkCustomerAccess,
    checkContractAccess,
    checkDocumentAccess,
    visibleCustomers,
    visibleContracts,
    canEditAdvisor,
    isAdmin: currentUser?.role === 'admin',
    isBroker: currentUser?.role === 'broker',
    isAssistant: currentUser?.role === 'assistenz',
  };
}