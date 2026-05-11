import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook für Zugriffskontrolle
 * Prüft, ob Benutzer auf einen Kunden/Vertrag zugreifen darf
 */
export function useAccessControl() {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  const { data: assignedCustomers = [] } = useQuery({
    queryKey: ['assignedCustomers', currentUser?.id],
    queryFn: () => {
      if (!currentUser?.id) return [];
      if (currentUser.role === 'admin') return null; // Admins sehen alles
      return base44.entities.CustomerAdvisor.filter({ advisor_id: currentUser.id });
    },
    enabled: !!currentUser?.id,
  });

  const { data: assignedContracts = [] } = useQuery({
    queryKey: ['assignedContracts', currentUser?.id],
    queryFn: () => {
      if (!currentUser?.id) return [];
      if (currentUser.role === 'admin') return null; // Admins sehen alles
      return base44.entities.ContractAdvisor.filter({ advisor_id: currentUser.id });
    },
    enabled: !!currentUser?.id,
  });

  const canViewCustomer = (customerId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (assignedCustomers === null) return true; // Admins
    return assignedCustomers.some(ca => ca.customer_id === customerId);
  };

  const canViewContract = (contractId, contractCustomerId) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    
    // Prüfe Vertrags-Zuordnung
    if (assignedContracts !== null && assignedContracts.some(ca => ca.contract_id === contractId)) {
      return true;
    }
    
    // Fallback: Kunden-Zuordnung
    if (assignedCustomers !== null && assignedCustomers.some(ca => ca.customer_id === contractCustomerId)) {
      return true;
    }
    
    return false;
  };

  const canEditAdvisor = () => {
    return currentUser?.role === 'admin';
  };

  const getVisibleCustomerIds = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return null; // null = alle sichtbar
    return assignedCustomers?.map(ca => ca.customer_id) || [];
  };

  const getVisibleContractIds = () => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return null; // null = alle sichtbar
    return assignedContracts?.map(ca => ca.contract_id) || [];
  };

  return {
    currentUser,
    canViewCustomer,
    canViewContract,
    canEditAdvisor,
    getVisibleCustomerIds,
    getVisibleContractIds,
    isAdmin: currentUser?.role === 'admin',
    isBroker: currentUser?.role === 'broker',
  };
}