# RAG-Based Activity Selection System - Implementation Guide

## Overview
This system allows users to click on activity categories ("What are you into?") and discover curated activities in their current city. The results are displayed in a beautiful card grid, and clicking on an activity adds it to their user profile with smart context caching for future RAG conversations.

---

## Architecture

### 1. **Activity Search Flow**
```
User clicks activity tile → searchActivities() 
  → POST /api/activity-search 
  → AI generates 5 relevant activities 
  → Display in card grid
```

### 2. **Activity Selection Flow**
```
User clicks activity card → selectActivity()
  → POST /api/travel-agent (mode: add-activity)
  → Activity added to selectedActivities (max 10, rotational deletion)
  → Activity cache created for RAG context
  → UI clears smoothly after 600ms
```

### 3. **Data Storage (Firestore userIndex)**
```javascript
userIndex/{uid} {
  selectedActivities: [
    {
      id: "activity-1-sf-food",
      title: "Ferry Building Farmers Market",
      category: "food",
      city: "San Francisco",
      addedAt: timestamp,
      context: { summary, whyRelevant, typical_duration },
      link: "https://...",
      place: { name, address, rating, reviews }
    }
  ],
  
  // Activity cache for RAG context
  activityCache_activity-1-sf-food-chat: {
    key: "activity-1-sf-food-chat",
    activityId: "activity-1-sf-food",
    title: "Ferry Building Farmers Market",
    category: "food",
    city: "San Francisco",
    summary: "A beloved weekly market...",
    systemPrompt: "User is interested in Ferry Building...",
    createdAt: timestamp
  }
}
```

---

## API Endpoints

### **POST /api/activity-search**
Fetches activities based on category and city using Gemini AI.

**Request:**
```json
{
  "category": "food",  // adventure, romance, whats-on, food, culture
  "city": "San Francisco",
  "limit": 5
}
```

**Response:**
```json
{
  "category": "food",
  "city": "San Francisco",
  "activities": [
    {
      "id": "activity-1-sf-food",
      "title": "Ferry Building Farmers Market - Tue & Sat",
      "description": "Fresh local produce...",
      "place": {
        "name": "Ferry Building Marketplace",
        "address": "1 Ferry Building, San Francisco, CA 94111",
        "rating": 4.6,
        "reviews": 2841
      },
      "category": "food",
      "date": {
        "when": "Every Tuesday & Saturday, 8AM-2PM",
        "nextEvent": "2026-05-17T08:00:00Z"
      },
      "thumbnail": "https://...",
      "link": "https://www.ferrybuilding.com",
      "context": {
        "summary": "A beloved weekly market...",
        "whyRelevant": "Perfect for food lovers...",
        "typical_duration": "1.5-2 hours"
      }
    }
    // ... 4 more activities
  ],
  "count": 5
}
```

### **POST /api/travel-agent (mode: add-activity)**
Adds activity to user profile with RAG cache.

**Request:**
```json
{
  "mode": "add-activity",
  "activityId": "activity-1-sf-food",
  "category": "food",
  "city": "San Francisco",
  "activityData": {
    // Full activity object from search results
  }
}
```

**Response:**
```json
{
  "success": true,
  "selectedActivities": [
    {
      "id": "activity-1-sf-food",
      "title": "Ferry Building Farmers Market",
      "category": "food",
      "city": "San Francisco",
      "addedAt": "2026-05-14T15:30:00Z",
      "context": { ... }
    }
  ],
  "totalSelected": 1,
  "maxCapacity": 10,
  "chatContext": {
    "cacheKey": "activity-1-sf-food-chat"
  }
}
```

### **POST /api/rag (Using Activity Cache)**
Future RAG queries can use the cached activity context.

**Request:**
```json
{
  "key": "activity-1-sf-food-chat",
  "prompt": "I'm going on Saturday. What should I know? What to bring?"
}
```

**Response:**
```json
{
  "response": "Perfect timing! Ferry Building is at its best on Saturday mornings...",
  "cached": false  // First time, will be cached
}
```

---

## Component Structure

### **Activity Search Mode (New)**
- Triggered when user clicks an activity tile
- Shows loading skeleton while fetching
- Displays 5 activity result cards
- Cards show:
  - Thumbnail image
  - Activity title
  - Place name
  - Date/time
  - Selection checkmark on click

### **ActivityResultCard Component**
```tsx
<ActivityResultCard
  activity={ActivityData}
  selected={boolean}      // Shows checkmark when selected
  onSelect={function}     // Called on click
  delay={number}          // Stagger animation
/>
```

---

## User Experience Flow

### **Scenario: User exploring food activities in San Francisco**

1. **Browse Mode** - User sees "What are you into?" with 5 category tiles
2. **Click "Food & Drink"** - Activity search starts
3. **Loading** - 3 skeleton cards animate in
4. **Results** - 5 food activity cards slide up with images:
   - Ferry Building Farmers Market
   - Michelin Star Dining (Nobu)
   - Mission District Food Tour
   - Wine Tasting at Ferry Plaza
   - Dim Sum Brunch at Yank Sing
5. **Click Ferry Building** - Card gets checkmark, fades slightly
6. **Auto-exit** (600ms later) - Returns to browse mode
7. **Activity saved** - Ferry Building now in user's activity index
8. **Future chats** - User can ask "Tell me more about Ferry Building" and AI uses cached context

---

## Key Features

### **Smart Rotational Deletion**
- Max 10 activities per user
- When adding 11th, oldest is removed
- Timestamps track when activities were added

### **Activity Context Cache (RAG)**
- Each activity has a `systemPrompt` that guides the AI
- Includes: summary, why it's relevant, typical duration
- AI references this when user asks follow-up questions
- Reduces hallucination and improves accuracy

### **Non-Disruptive UX**
- Click doesn't navigate away (no page reload)
- Results in drawer/modal that slides up
- Smooth exit animation back to browse mode
- No jarring transitions

### **Real Activity Data**
- Uses Gemini 3.1 Flash Lite for speed
- Generates realistic activity titles, descriptions, times
- Fallback mock data if AI unavailable
- Includes venue ratings, addresses, links

---

## Future Enhancements

### **Phase 2: Activity Recommendations**
- Use LLM to suggest activities based on user's category selections
- "You liked Food & Culture, try these Adventure activities"

### **Phase 3: Activity Groups**
- Create itineraries from multiple activities
- "Build your perfect day" - combine 3-4 activities

### **Phase 4: Activity Ratings**
- User rates activities after visiting
- Improve recommendations based on ratings
- Share itineraries with friends

### **Phase 5: Real-time Integration**
- Connect to Google Events, Eventbrite, OpenTable
- Real availability checking
- Direct booking from app

---

## Database Schema Notes

### Activity in userIndex
```typescript
interface SelectedActivity {
  id: string;                    // Unique activity ID
  title: string;                 // Activity name
  category: string;              // activity-search category
  city: string;                  // Where it is
  addedAt: Timestamp;            // When user selected it
  context: {                      // RAG context
    summary: string;             // What makes it special
    whyRelevant: string;         // Why user should visit
    typical_duration: string;    // How long it takes
  };
  link?: string;                 // Website or booking
  place: {                        // Location info
    name: string;
    address: string;
    rating?: number;
    reviews?: number;
  };
}
```

### Activity Cache Entry
```typescript
interface ActivityCache {
  key: string;                   // Firestore doc key
  activityId: string;            // Reference to activity
  title: string;
  category: string;
  city: string;
  summary: string;               // RAG content
  systemPrompt: string;          // Guides AI responses
  createdAt: Timestamp;
}
```

---

## Testing Checklist

- [ ] Click activity tile → activity search loads
- [ ] Results display 5 activities with images
- [ ] Click activity card → checkmark appears
- [ ] Card becomes slightly transparent when selected
- [ ] Auto-exit after 600ms returns to browse
- [ ] Activity appears in Firestore userIndex
- [ ] Activity cache created with correct systemPrompt
- [ ] Subsequent RAG queries use cached context
- [ ] Max 10 activities enforced (11th removes oldest)
- [ ] Works offline (fallback mock data)

---

## Performance Notes

- **Activity Search API**: ~800ms-1.2s (AI generation)
- **Activity Selection Save**: ~200-400ms (Firestore write)
- **Total Flow**: ~1.2-1.6s (perceived as instant with animations)
- **Mock Data Fallback**: <100ms

---

## Error Handling

### Network Error
→ Retry button shows, user can retry

### Firestore Write Error
→ "Failed to save activity" toast, user can retry

### AI Generation Error
→ Fallback to mock activities automatically

### Empty Results
→ "No activities found" message with suggestion to change category
