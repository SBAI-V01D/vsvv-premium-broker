import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Migriert alle bestehenden Kunden ohne customer_number
 * Vergibt automatisch eindeutige Nummern ab K-500
 * Admin-only Funktion
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Hole alle Kunden
    const allCustomers = await base44.entities.Customer.list(null, 5000);
    
    // Finde Kunden ohne customer_number
    const customersToMigrate = allCustomers.filter(c => !c.customer_number);
    
    if (customersToMigrate.length === 0) {
      return Response.json({ 
        success: true,
        message: 'Alle Kunden haben bereits eine Kundennummer',
        migrated: 0
      });
    }

    // Bestimme Startnummer
    const customersWithNumber = allCustomers.filter(c => c.customer_number);
    const existingNumbers = customersWithNumber
      .map(c => {
        const match = c.customer_number.match(/K-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n >= 500);

    let nextNumber = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 500;

    // Sortiere zu migrierende Kunden nach created_date (älteste zuerst)
    const sortedCustomers = customersToMigrate.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateA - dateB;
    });

    // Migriere Kunden
    const migratedCustomers = [];
    for (const customer of sortedCustomers) {
      const customerNumber = `K-${nextNumber}`;
      
      await base44.entities.Customer.update(customer.id, {
        customer_number: customerNumber
      });
      
      migratedCustomers.push({
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        customer_number: customerNumber
      });
      
      nextNumber++;
    }

    console.log(`Migration complete: ${migratedCustomers.length} customers migrated`);

    return Response.json({ 
      success: true,
      migrated: migratedCustomers.length,
      customers: migratedCustomers
    });
  } catch (error) {
    console.error('Error migrating customer numbers:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});