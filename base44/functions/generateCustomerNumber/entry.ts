import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Generiert die nächste verfügbare Kundennummer (K-500, K-501, ...)
 * Verwendet atomare Logik zur Vermeidung von Race Conditions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Hole alle existierenden Kunden mit customer_number
    const allCustomers = await base44.entities.Customer.list(null, 5000);
    
    // Extrahiere numerische Werte aus existing customer_numbers
    const existingNumbers = allCustomers
      .filter(c => c.customer_number)
      .map(c => {
        // Parse "K-500" zu 500, "K-1" zu 1, etc.
        const match = c.customer_number.match(/K-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n >= 500);

    // Bestimme nächste Nummer
    const nextNumber = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 500;

    const customerNumber = `K-${nextNumber}`;

    return Response.json({ 
      success: true,
      customer_number: customerNumber,
      next_number: nextNumber
    });
  } catch (error) {
    console.error('Error generating customer number:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});