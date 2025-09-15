# EditMatchModal Component

Enhanced modal component for organizers to edit existing play dates in the tennis match application.

## Overview

The `EditMatchModal` component provides a comprehensive interface for editing play date details with the following key features:

- **Diff-based updates**: Only sends changed fields to the server
- **Smart notifications**: Automatically notifies players when important details change
- **Player management**: View and remove players from the play date
- **Accessibility**: Full keyboard navigation and screen reader support
- **Error handling**: Robust error states and retry mechanisms

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `playDateId` | `string\|number` | Yes | The ID of the play date to edit |
| `isOpen` | `boolean` | Yes | Controls modal visibility |
| `onClose` | `function` | Yes | Callback when modal should close |
| `onSaved` | `function` | No | Callback when play date is successfully saved |

## API Integration

The component integrates with the following endpoints:

### GET `/playdates/:id`
Fetches play date data. Expected response format:
```json
{
  "id": "123",
  "date": "2024-01-15",
  "time": "14:00",
  "durationHours": 2,
  "location": "Central Park Tennis Courts",
  "notes": "Bring water",
  "maxPlayers": 4,
  "currentPlayers": 2,
  "format": "doubles",
  "skillLevel": "3.5",
  "isPublic": true,
  "allowWaitlist": true,
  "players": [
    {
      "id": "456",
      "name": "John Doe",
      "initials": "JD",
      "ntrp": "3.5",
      "status": "confirmed",
      "isHost": true
    }
  ]
}
```

### PATCH `/playdates/:id`
Updates play date with only changed fields:
```json
{
  "durationHours": 2.5,
  "notes": "Updated notes"
}
```

### POST `/playdates/:id/notify`
Sends notifications when detail fields change:
```json
{
  "type": "details_changed",
  "fields": ["time", "duration"]
}
```

## Notification Logic

The component automatically determines when to send notifications based on changed fields:

**Notification-triggering fields:**
- `date` - Play date
- `time` - Start time  
- `duration` - Duration in hours
- `location` - Court location
- `format` - Match format (singles, doubles, etc.)
- `skillLevel` - Required skill level
- `maxPlayers` - Maximum number of players

**Non-notification fields:**
- `notes` - Additional information
- `isPublic` - Privacy setting
- `allowWaitlist` - Waitlist setting

## Field Mapping

The component handles automatic mapping between server and client field names:

| Server Field | Client Field | Description |
|--------------|--------------|-------------|
| `durationHours` | `duration` | Duration as number vs string |

## Usage Example

```jsx
import { useState } from 'react';
import EditMatchModal from './components/edit-match-modal';

function MyComponent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playDateId, setPlayDateId] = useState(null);

  const handleOpenEdit = (id) => {
    setPlayDateId(id);
    setIsModalOpen(true);
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setPlayDateId(null);
  };

  const handleSaved = () => {
    // Refresh data, show success message, etc.
    console.log('Play date updated successfully');
  };

  return (
    <div>
      <button onClick={() => handleOpenEdit('123')}>
        Edit Play Date
      </button>
      
      <EditMatchModal
        playDateId={playDateId}
        isOpen={isModalOpen}
        onClose={handleClose}
        onSaved={handleSaved}
      />
    </div>
  );
}
```

## Features

### Form Fields
- **Date & Time**: Date picker and time input
- **Duration**: Dropdown with common duration options
- **Format**: Match format selection (auto-updates max players)
- **Location**: Text input for court location
- **Skill Level**: Dropdown from beginner to advanced
- **Max Players**: Number input (2-12)
- **Notes**: Textarea for additional information
- **Privacy**: Checkbox for public/private
- **Waitlist**: Checkbox to allow waitlist when full

### Player Management
- View all confirmed players
- Remove non-host players (UI only - endpoint stubbed)
- Player avatars with initials
- Host identification
- NTRP ratings display

### Share Features
- Copy play date link to clipboard
- Native share API integration (mobile)
- Fallback to clipboard for unsupported browsers

### Accessibility
- **Keyboard Navigation**: Tab through all interactive elements
- **Escape Key**: Closes modal
- **Focus Management**: Auto-focus on modal open, trap focus within modal
- **Screen Readers**: Proper ARIA labels and roles
- **Semantic HTML**: Proper heading hierarchy and form structure

### Error Handling
- Loading states during API calls
- Error messages for failed operations
- Retry mechanism for failed requests
- Validation feedback for form fields

### Cancel Confirmation
- Detects unsaved changes
- Shows confirmation dialog before closing
- Prevents accidental data loss

## Styling

The component uses Tailwind CSS classes consistent with the existing application design:

- **Colors**: Green accent colors for primary actions
- **Typography**: Bold headings, medium body text
- **Spacing**: Consistent padding and margins
- **Interactive States**: Hover effects, focus rings
- **Responsive**: Works on mobile and desktop

## Testing

The component includes comprehensive testing features:

1. **Manual Testing**: Test page at `/#/test-edit-modal` (during development)
2. **Error Simulation**: Handles API failures gracefully
3. **Edge Cases**: Empty data, missing fields, network errors
4. **Accessibility**: Keyboard navigation, screen reader compatibility

## Implementation Notes

- Uses React hooks for state management
- Implements proper cleanup for async operations
- Follows existing code patterns in the repository
- Integrates with centralized API service layer
- Maintains backward compatibility with existing endpoints

## Future Enhancements

Planned improvements (not in current implementation):

- Real player removal endpoint integration
- Real cancellation endpoint integration
- Toast notification system
- Form validation with inline error messages
- Optimistic updates for better UX
- Undo functionality for player removal