# Payment Fairness System for Rejected & Reassigned Tasks

## Overview
This document describes the payment fairness system implemented to ensure that when an image set is rejected and reassigned to another annotator, only the annotator who successfully completes the work receives payment.

## Problem Statement
Previously, if an annotator's work was rejected and the task was reassigned to another annotator, both annotators could potentially be eligible for payment, creating unfairness and increased costs.

## Solution

### Database Changes

#### 1. Tasks Table - New Column
Added `eligible_for_payment` column to the `tasks` table:
```sql
eligible_for_payment BOOLEAN DEFAULT TRUE
```

This field tracks whether a specific task assignment is eligible for payment.

### Backend Logic

#### 2. Tester Review Logic (Rejection Handling)
Location: `server/src/routes/dashboard.routes.js` - Tester review endpoint

When a tester **rejects** an image:
```javascript
// Mark all previous annotation tasks for this image as ineligible for payment
if (status === 'rejected') {
  await connection.execute(
    `UPDATE tasks SET eligible_for_payment = FALSE 
     WHERE image_id = ? AND task_type = 'annotation' AND status IN ('completed', 'pending_review', 'rejected')`,
    [imageId]
  );
}
```

This ensures:
- All previous annotation attempts for that image are marked as ineligible
- Only future successful completions will be eligible for payment

#### 3. Payment Calculations
Location: `server/src/routes/dashboard.routes.js` - Annotator payments endpoint

Updated payment queries to only count eligible tasks:
```javascript
const [tasksCompleted] = await connection.execute(
  `SELECT COUNT(*) as count FROM tasks 
   WHERE user_id = ? AND status = 'completed' AND eligible_for_payment = TRUE`,
  [userId]
);
```

#### 4. Payment Creation
Location: `server/src/routes/dashboard.routes.js` - POST /payments endpoint

Added documentation:
```javascript
// Note: Payments should only be created for tasks where eligible_for_payment = TRUE
// This ensures fairness: if work is rejected and reassigned, only the successful annotator gets paid
```

Admins should verify `eligible_for_payment = TRUE` before creating payment records.

### Admin Tools

#### 5. Payment Eligibility Report
**New Page:** `client/src/pages/admin/PaymentEligibility.jsx`
**Route:** `/admin/payment-eligibility`
**API Endpoint:** `GET /api/dashboard/admin/payment-eligibility`

This report shows:
- All annotation tasks for each image
- Assignment history (shows if an image was reassigned)
- Payment eligibility status for each annotator
- Visual indicators (✅ ELIGIBLE / ❌ NOT ELIGIBLE)

Features:
- Groups tasks by image to show reassignment history
- Highlights images that have been assigned multiple times
- Shows which annotator will get paid for each image

### Frontend Changes

#### 6. Admin Sidebar Update
Added "Payment Eligibility" menu item in `AdminSidebar.jsx`:
```javascript
{ name: "Payment Eligibility", icon: DollarSign, path: "/admin/payment-eligibility" }
```

#### 7. App Routing
Added route in `App.jsx`:
```javascript
<Route path="/admin/payment-eligibility" element={<PaymentEligibility />} />
```

## Workflow Example

### Scenario: Image Rejected and Reassigned

1. **Initial Assignment**
   - Admin assigns Image #123 to Annotator A
   - Task created with `eligible_for_payment = TRUE`

2. **Annotator A Completes Work**
   - Annotator A submits completed work
   - Task status: `completed`, `eligible_for_payment = TRUE`

3. **Tester Rejects Work**
   - Tester reviews and rejects the work
   - **System automatically sets:** Annotator A's task `eligible_for_payment = FALSE`
   - Image status: `rejected`

4. **Admin Reassigns to Annotator B**
   - Admin assigns Image #123 to Annotator B
   - New task created with `eligible_for_payment = TRUE`

5. **Annotator B Completes Work**
   - Annotator B submits work
   - Task status: `completed`, `eligible_for_payment = TRUE`

6. **Tester Approves Work**
   - Tester reviews and approves
   - Image status: `approved`

7. **Payment Processing**
   - Admin creates payment
   - **Only Annotator B receives payment** (their task has `eligible_for_payment = TRUE`)
   - Annotator A does NOT receive payment (their task has `eligible_for_payment = FALSE`)

## Admin Usage Guide

### How to Use Payment Eligibility Report

1. Navigate to **Admin Dashboard** → **Payment Eligibility**

2. The report shows all images with their assignment history

3. **Understanding the Display:**
   - Each image card shows all annotators who worked on it
   - Yellow warning box indicates multiple assignments (rejection occurred)
   - Green ✅ ELIGIBLE badge: This annotator will be paid
   - Red ❌ NOT ELIGIBLE badge: This annotator will NOT be paid

4. **Before Creating Payments:**
   - Review this report to understand who should be paid
   - Only create payment records for annotators marked as ELIGIBLE
   - Verify the payment eligibility matches your business rules

### Payment Creation Best Practices

When creating payments manually:
```sql
-- ✅ CORRECT: Only select tasks eligible for payment
SELECT user_id, COUNT(*) as tasks_count
FROM tasks
WHERE status = 'approved' 
  AND task_type = 'annotation'
  AND eligible_for_payment = TRUE
GROUP BY user_id;

-- ❌ INCORRECT: Would include rejected work
SELECT user_id, COUNT(*) as tasks_count
FROM tasks
WHERE status = 'approved' 
  AND task_type = 'annotation'
GROUP BY user_id;
```

## Benefits

1. **Fairness:** Only annotators who successfully complete work get paid
2. **Cost Control:** Eliminates duplicate payments for rejected work
3. **Transparency:** Clear audit trail of payment eligibility
4. **Automation:** System automatically handles eligibility when rejections occur
5. **Reporting:** Admins can easily verify who should be paid

## Database Migration

The system automatically adds the `eligible_for_payment` column when the server starts:
```javascript
await ensureColumn("tasks", "eligible_for_payment", "BOOLEAN DEFAULT TRUE");
```

Existing tasks default to `eligible_for_payment = TRUE`.

## Future Enhancements

Potential improvements:
1. Automated payment record creation based on eligible tasks
2. Notification to annotators when their work becomes ineligible
3. Dashboard widget showing payment-eligible task counts
4. Export payment eligibility report to CSV
5. Configure payment rates per task type

## Testing Checklist

- [ ] Create task and verify `eligible_for_payment = TRUE`
- [ ] Reject task and verify `eligible_for_payment = FALSE`
- [ ] Reassign task and verify new task has `eligible_for_payment = TRUE`
- [ ] Check payment eligibility report shows correct status
- [ ] Verify payment calculations only count eligible tasks
- [ ] Test with multiple rejections/reassignments
- [ ] Verify annotator payment dashboard shows correct totals

## Support

For questions or issues with the payment fairness system:
- Review the Payment Eligibility Report in admin dashboard
- Check task records in the database for `eligible_for_payment` status
- Verify tester review logs for rejection actions
- Contact system administrator if eligibility status seems incorrect
