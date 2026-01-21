# Melbourne User Dashboard - Testing Guide

## Overview
The Melbourne User role is the final approval layer in the workflow. Melbourne users review tester-approved datasets and provide final approval or rejection with feedback.

## Workflow
1. **Admin** assigns image to annotator and tester
2. **Annotator** completes annotation
3. **Tester** reviews and approves/rejects with feedback
4. **Melbourne User** reviews tester-approved datasets
5. Final approval makes dataset production-ready

## Features Implemented

### Dashboard (/melbourne/dashboard)
- **KPI Cards:**
  - Pending Review: Datasets awaiting Melbourne approval
  - Approved: Production-ready datasets
  - Rejected: Datasets requiring revision
  - Total Reviewed: All-time review count

- **Progress Chart:**
  - Line chart showing approved vs rejected over time
  - Uses recharts library

- **Datasets Table:**
  - Shows all tester-approved datasets
  - Columns: Dataset ID, Location, Annotator, Tester, Objects, Date, Action
  - Review button opens detailed review modal

### Review Modal
- **Dataset Information:**
  - Dataset ID, Location, Objects Count, Collection Date

- **Workflow History:**
  - Shows annotator name
  - Shows tester name who approved

- **Tester Feedback:**
  - Displays feedback from tester review

- **Review Actions:**
  - Approve Dataset button (green)
  - Reject Dataset button (red)
  - Feedback textarea (required)

- **Notifications:**
  - On approval/rejection, notifications sent to:
    - Annotator
    - Tester
    - All admins

### Profile Page (/melbourne/profile)
- Update name, email, phone
- Change password
- View role (melbourne_user)

### Sidebar
- Dashboard navigation
- Profile navigation
- Notifications bell icon
- Logout

## Backend API Endpoints

### GET /api/dashboard/melbourne/dashboard
Returns:
```json
{
  "pendingReview": 5,
  "approved": 12,
  "rejected": 3,
  "progressOverTime": [
    { "date": "2024-01", "approved": 10, "rejected": 2 }
  ]
}
```

### GET /api/dashboard/melbourne/datasets
Returns array of tester-approved datasets:
```json
[
  {
    "image_id": 1,
    "location": "Beach A",
    "annotator_name": "John Doe",
    "tester_name": "Jane Smith",
    "tester_feedback": "Good quality annotations",
    "objects_count": 45,
    "created_at": "2024-01-15"
  }
]
```

### PUT /api/dashboard/melbourne/datasets/:id/review
Request body:
```json
{
  "status": "approved",  // or "rejected"
  "feedback": "Dataset meets production standards"
}
```

Response:
```json
{
  "message": "Review submitted successfully"
}
```

### GET /api/dashboard/melbourne/recent-reviews
Returns last 10 reviews by the Melbourne user.

## Testing Steps

### 1. Create Melbourne User
```sql
INSERT INTO users (name, email, password, role) 
VALUES ('Melbourne User', 'melbourne@test.com', '$2b$10$hashedpassword', 'melbourne_user');
```

### 2. Login as Melbourne User
- Navigate to /login
- Enter credentials
- Should redirect to /melbourne/dashboard

### 3. Test Dashboard
- Verify KPI cards show correct counts
- Check progress chart renders
- View datasets table
- Click Review button on a dataset

### 4. Test Review Modal
- Verify dataset information displays
- Check workflow history (annotator/tester names)
- Read tester feedback
- Select Approve or Reject
- Enter feedback (required)
- Submit review

### 5. Verify Notifications
- Check annotator receives notification
- Check tester receives notification
- Check admins receive notification
- Verify notification types are correct

### 6. Test Profile Page
- Update profile information
- Change password
- Verify changes persist

## Database Requirements

### Images Table
Must have these columns:
- `melbourne_user_id` INT (NULL when pending review)
- `melbourne_feedback` TEXT
- `status` ENUM including 'approved', 'rejected'

### Notifications Table
- `user_id` INT
- `type` VARCHAR (dataset_approved, dataset_rejected)
- `message` TEXT
- `image_id` INT
- `read_status` BOOLEAN
- `created_at` TIMESTAMP

## Styling
Uses existing annotator.css with additional Melbourne-specific styles:
- .review-section
- .info-grid
- .workflow-timeline
- .feedback-box
- .review-actions
- .review-btn (approve/reject)

## Protected Routes
- All Melbourne routes require `role === 'melbourne_user'`
- Unauthorized users redirected to their appropriate dashboard
- JWT token validation on all API calls

## Notes
- Melbourne dashboard only shows datasets with `status='approved'` AND `melbourne_user_id IS NULL`
- After Melbourne review, dataset status remains 'approved' or changes to 'rejected'
- Melbourne user ID is set on the image record
- Progress chart aggregates by month
- Notifications auto-refresh every 30 seconds
- Review modal requires both action selection and feedback
