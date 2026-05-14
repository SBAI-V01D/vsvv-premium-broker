# 🔒 RLS AUDIT FINDINGS – PHASE 1 (P1 ENTITIES)

**Audit Date:** 2026-05-14  
**Scope:** Critical P1 Entities  
**Status:** ⚠️ CRITICAL ISSUES IDENTIFIED  

---

## 🎯 AUDIT SCOPE

### P1 Entities (Must be hardened BEFORE go-live)

| Entity | Issue | Risk | Action |
|--------|-------|------|--------|
| **Customer** | ❓ Unknown | 🔴 CRITICAL | [ ] Audit |
| **Lead** | ❓ Unknown | 🔴 CRITICAL | [ ] Audit |
| **Opportunity** | ❓ Unknown | 🔴 CRITICAL | [ ] Audit |
| **Contract** | ❓ Unknown | 🔴 CRITICAL | [ ] Audit |
| **CommissionEntry** | ⚠️ Partial | 🟡 MEDIUM | [ ] Verify |
| **Application** | ❓ Unknown | 🟡 HIGH | [ ] Audit |

---

## 📋 ENTITY RLS AUDIT TEMPLATE

For each Entity, we need to verify:

```javascript
// TEMPLATE: RLS Audit Checklist for Entity: [NAME]

1. LIST OPERATION
   [ ] Advisor A can list all Customers?
   [ ] Advisor A can list only own Customers?
   [ ] Team Lead can list Team?
   [ ] Admin can list all?
   Backend Function: getVisibleData() or filter()?
   
2. GET OPERATION
   [ ] Advisor A can read own Customer details?
   [ ] Advisor A can read Advisor B's Customer details?
   Backend Function: guardDataAccess()?
   
3. CREATE OPERATION
   [ ] Advisor A can create Customer?
   [ ] Does system auto-set assigned_advisor?
   [ ] Can Advisor change assigned_advisor to someone else?
   
4. UPDATE OPERATION
   [ ] Advisor A can update own Customer?
   [ ] Advisor A can update Advisor B's Customer?
   [ ] Can non-owner update access_level?
   [ ] Can Advisor change ownership?
   
5. DELETE OPERATION
   [ ] Is delete forbidden (soft delete only)?
   [ ] Can Advisor delete own Customer?
   [ ] Can Advisor delete Advisor B's Customer?
   
6. FILTERING & VISIBILITY
   [ ] Customer has access_level field?
   [ ] Customer has assigned_advisors array?
   [ ] Filter logic implemented correctly?
   
7. REPORTING & EXPORT
   [ ] KPI Reports show only visible data?
   [ ] CSV Export filtered by RLS?
   [ ] BI Queries respect RLS?
   
8. RELATED RECORDS
   [ ] If Customer is visible, related Contracts visible?
   [ ] If Customer is visible, related Leads visible?
   [ ] Cross-entity leaks possible?
```

---

## 🔍 FINDINGS PER ENTITY

### Entity: CUSTOMER

**Schema Check:**
```json
{
  "access_level": {
    "enum": ["public_admin_only", "assigned_advisors_only", "team_visible", "all_internal"],
    "description": "Sichtbarkeitsstufe"
  },
  "primary_advisor_id": {
    "type": "string",
    "description": "Hauptberater-ID (User)"
  },
  "assigned_advisors": {
    "type": "array",
    "items": {"type": "string"},
    "description": "Array von zugewiesenen Berater-IDs"
  },
  "assigned_assistants": {
    "type": "array",
    "items": {"type": "string"},
    "description": "Array von zugewiesenen Assistenten-IDs"
  }
}
```

**RLS Check:**

```
✅ Schema hat RLS Fields
❓ Aber: Wo wird filteriert?
❓ Backend: Gibt es guardDataAccess() für Customer?
❓ Frontend: Nutzt getVisibleData() bei list()?
```

**Test Cases (MUST RUN):**

```javascript
// TEST 1: Can Advisor A list Advisor B's Customers?
const advisorA_customers = await base44.entities.Customer.list()
const advisorB_customer_id = 'cust-999' // known to belong to Advisor B
const isVisible = advisorA_customers.find(c => c.id === advisorB_customer_id)
EXPECT: isVisible === undefined ✓

// TEST 2: Can Admin list all Customers?
const adminUser = { role: 'admin', ... }
const allCustomers = await base44.entities.Customer.list()
EXPECT: allCustomers.length > 100 ✓

// TEST 3: Can Advisor A update Advisor B's Customer?
TRY: await base44.entities.Customer.update('cust-999', { notes: 'hacked' })
EXPECT: 403 Forbidden ✓

// TEST 4: Does system enforce access_level?
const publicCustomer = { access_level: 'public_admin_only', ... }
const advisorData = await getVisibleData(advisorUser, 'Customer')
EXPECT: publicCustomer NOT in advisorData ✓
```

**Issues Found:**
- ⚠️ TBD (Need to run tests)

---

### Entity: LEAD

**Schema Check:**
```json
{
  // NO RLS FIELDS VISIBLE IN SCHEMA?
  // Need to verify if Lead has:
  // - access_level?
  // - assigned_to?
  // - primary_advisor_id?
}
```

**RLS Status:** ❓ UNKNOWN – Need to check Lead entity schema

**Test Cases (MUST RUN):**

```javascript
// TEST 1: Does Lead auto-assign to current advisor?
const createdLead = await base44.entities.Lead.create({ ... })
EXPECT: createdLead.assigned_to === currentAdvisor.id ✓

// TEST 2: Can Advisor A see Advisor B's Leads?
const advisorA_leads = await base44.entities.Lead.list()
const advisorB_lead_id = 'lead-999'
EXPECT: advisorA_leads.find(l => l.id === advisorB_lead_id) === undefined ✓

// TEST 3: Can Advisor reassign Lead to another Advisor?
TRY: await base44.entities.Lead.update('lead-999', { assigned_to: anotherAdvisor })
EXPECT: Either 403 Forbidden OR only own leads ✓
```

**Issues Found:**
- 🔴 CRITICAL: Lead entity appears to have minimal RLS
- ❓ Need to verify if Lead filtering is implemented

---

### Entity: OPPORTUNITY

**RLS Status:** ❓ UNKNOWN

**Schema has fields:**
```json
{
  // Check if Opportunity has:
  "customer_id": "✓ Yes – can use for filtering",
  "assigned_to": "? Unknown"
}
```

**Issues Found:**
- 🔴 CRITICAL: Opportunity visibility unclear
- ❓ Can Advisor A see Advisor B's Opportunities?

---

### Entity: CONTRACT

**RLS Status:** ⚠️ PARTIAL (schema has fields, implementation unknown)

**Schema has fields:**
```json
{
  "primary_broker_id": "✓ Yes",
  "assigned_brokers": "✓ Array",
  "assigned_team": "✓ Array",
  "access_level": "✓ Yes"
}
```

**Test Cases (MUST RUN):**

```javascript
// TEST 1: Advisor A filters own Contracts
const myContracts = await base44.entities.Contract.filter({ primary_broker_id: advisorA.id })
EXPECT: Only advisorA's contracts ✓

// TEST 2: Advisor A tries to get Advisor B's Contract
TRY: const contract = await base44.entities.Contract.get('contract-999') // belongs to Advisor B
EXPECT: 403 Forbidden ✓
```

---

### Entity: COMMISSIONENTRY

**RLS Status:** ⚠️ PARTIAL (has guardCommissionAccess())

**Existing Protection:**
```javascript
✅ guardCommissionAccess() exists
✅ Called in CommissionsAndCourtage.jsx before create
❓ But: Is it called everywhere? (update, delete, etc.)
❓ Is it called in BI queries?
```

**Test Cases (VERIFIED):**

```javascript
// Exists in CommissionsAndCourtage.jsx line 113-120:
const accessCheck = await base44.functions.invoke('guardCommissionAccess', {
  action: 'create',
  advisor_id: data.advisor_id,
})
✓ Guards CREATE operations

// But: What about UPDATE, DELETE, LIST?
❓ TBD
```

**Issues Found:**
- ⚠️ CREATE protected, but UPDATE/DELETE/LIST unknown

---

### Entity: APPLICATION

**RLS Status:** ❓ UNKNOWN

**Schema has:**
```json
{
  "customer_id": "✓ Yes",
  "advisor_id": "✓ Yes",
  "organization_id": "✓ Yes"
}
```

**Issues Found:**
- ❓ CRITICAL: Application RLS implementation unknown
- Can Advisor A list Advisor B's Applications?

---

## 🚨 CRITICAL ISSUES – MUST FIX BEFORE GO-LIVE

### Issue 1: No Comprehensive RLS Guard Functions

**Current State:**
- ✅ `guardCommissionAccess()` exists
- ✅ `guardPortalAccess()` exists
- ✅ `guardDocumentAccess()` exists
- ❌ `guardCustomerAccess()` – MISSING
- ❌ `guardLeadAccess()` – MISSING
- ❌ `guardOpportunityAccess()` – MISSING
- ❌ `guardContractAccess()` – MISSING
- ❌ `guardApplicationAccess()` – MISSING

**Fix Required:**
Create guard functions for P1 entities that:
1. Verify user is authenticated
2. Check if user can access this entity type
3. Verify user can access this specific record
4. Return 403 if not allowed

---

### Issue 2: Frontend list() Calls May Not Filter

**Current Code Pattern:**
```javascript
// pages/CommissionsAndCourtage.jsx line 68-69:
const { data: entries = [] } = useQuery({
  queryKey: ['commissionEntries'],
  queryFn: () => base44.entities.CommissionEntry.list('-entry_date', 5000),
})
```

**Questions:**
- Does `base44.entities.CommissionEntry.list()` automatically filter by RLS?
- Or does backend need to implement filtering?
- Can Advisor A see all CommissionEntries from all Advisors?

**Fix Required:**
- Verify that SDK-level list() filters by RLS
- OR: Backend functions that implement RLS-aware list()

---

### Issue 3: BI Queries Not RLS-Protected

**Risk:**
```javascript
// If someone makes BI query like:
const allEntries = await base44.entities.CommissionEntry.list()
const kpi = calcKPIs(allEntries)
// This calculates KPI for ALL advisors (security breach!)
```

**Fix Required:**
- BI queries MUST pass through RLS filter
- KPI calculations MUST be Advisor-scoped

---

## 📋 RLS HARDENING ROADMAP

### Phase 1a: Guard Functions (Today)

Create these backend functions:

```
✅ guardCommissionAccess() – EXISTS
❌ guardCustomerAccess() – CREATE
❌ guardLeadAccess() – CREATE
❌ guardOpportunityAccess() – CREATE
❌ guardContractAccess() – CREATE
❌ guardApplicationAccess() – CREATE
```

Each function:
```javascript
export async function guardCustomerAccess(req) {
  const base44 = createClientFromRequest(req)
  const user = await base44.auth.me()
  
  if (!user) return { allowed: false, reason: 'Not authenticated' }
  
  const { action, entity_id, advisor_id } = await req.json()
  
  // Rules:
  // - Admin can access anything
  // - Advisor can only access own customers (primary_advisor_id === user.id)
  // - Team Lead can access team members' customers
  
  const customer = await base44.asServiceRole.entities.Customer.get(entity_id)
  const isOwner = customer.primary_advisor_id === user.id
  const isTeamMember = customer.assigned_advisors?.includes(user.id)
  const isAdmin = user.role === 'admin'
  
  const allowed = isAdmin || isOwner || isTeamMember
  
  return { allowed, reason: allowed ? 'OK' : 'Not authorized to access this customer' }
}
```

### Phase 1b: Update Entity Schemas (Today)

Ensure all P1 entities have RLS fields:
- ✅ Customer – has fields
- ⚠️ Lead – NEEDS audit
- ⚠️ Opportunity – NEEDS audit
- ⚠️ Contract – has fields
- ⚠️ Application – NEEDS audit

### Phase 1c: Testing (Today)

Run RLS penetration tests:
```
[ ] Customer: Advisor A cannot list Advisor B's customers
[ ] Lead: Advisor A cannot list Advisor B's leads
[ ] Opportunity: Advisor A cannot see Advisor B's deals
[ ] Contract: Advisor A cannot read Advisor B's contracts
[ ] Application: Advisor A cannot access Advisor B's applications
[ ] CommissionEntry: Advisor A cannot see Advisor B's commissions
```

---

## 🔐 Security Sign-Off Checklist

Before go-live, ALL must pass:

```
AUTHENTICATION:
[ ] All backend functions verify user is authenticated
[ ] No unauthenticated access to sensitive data

AUTHORIZATION:
[ ] Each entity has guard function
[ ] Guard function checks ownership/team membership
[ ] Admin has elevated access
[ ] Non-owner gets 403

FILTERING:
[ ] list() operations filter by RLS
[ ] export() operations filter by RLS
[ ] BI queries filter by RLS
[ ] Reports show only visible data

PENETRATION TEST:
[ ] Advisor A cannot access Advisor B's customers
[ ] Advisor A cannot update Advisor B's contracts
[ ] Advisor A cannot delete Advisor B's leads
[ ] Non-admin cannot escalate privileges
[ ] No SQL injection possible
[ ] No cross-tenant data leaks

AUDIT:
[ ] All changes logged to AuditLog
[ ] Failed access attempts logged
[ ] Data exports logged

ENCRYPTION:
[ ] Passwords hashed (if applicable)
[ ] Sensitive fields encrypted (if applicable)
[ ] API calls use HTTPS
```

---

## ⚡ NEXT STEPS

### IMMEDIATE (Today)

1. **Run RLS Tests** on each P1 entity
2. **Document findings** in this audit
3. **Create guard functions** for missing entities
4. **Fix identified gaps**

### TODAY'S TASKS

```
[ ] Read Customer entity schema – fully audit RLS
[ ] Read Lead entity schema – audit RLS
[ ] Read Opportunity entity schema – audit RLS
[ ] Read Contract entity schema – verify RLS
[ ] Read Application entity schema – audit RLS
[ ] Create guard functions for each
[ ] Test each guard function
[ ] Update this document with results
[ ] Get security approval
```

---

**AUDIT STATUS:** 🔴 IN PROGRESS  
**BLOCKING:** ✅ Go-Live readiness  
**CRITICAL:** 🔴 Must complete before deployment