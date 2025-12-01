# HTTP/2 Fallback Testing Guide

## Overview

The HTTP/2 to HTTP/1.1 fallback mechanism has been implemented to resolve the `ERR_HTTP2_PROTOCOL_ERROR` issues you were experiencing. This system automatically detects HTTP/2 protocol errors and switches to HTTP/1.1 when needed.

## How It Works

1. **Primary Client**: Uses HTTP/2 by default for optimal performance
2. **Error Detection**: Monitors for HTTP/2 protocol errors (`ERR_HTTP2_PROTOCOL_ERROR`, etc.)
3. **Automatic Fallback**: Switches to HTTP/1.1 client after 3 HTTP/2 errors
4. **Recovery Attempts**: Periodically tries to reconnect to HTTP/2 when conditions improve

## Testing the Fallback

### Console Testing (Development Mode)

Open your browser's developer console and use these commands:

```javascript
// Test the HTTP/2 fallback mechanism
await window.http2FallbackTest.test()

// Get current system status
window.http2FallbackTest.status()

// Reset to primary HTTP/2 client
window.http2FallbackTest.reset()

// Monitor HTTP/2 errors in real-time
const stopMonitoring = window.http2FallbackTest.monitor((status) => {
  console.log('Client status changed:', status);
});

// Stop monitoring
stopMonitoring();
```

### Manual Testing

1. **Force Fallback**: Use the console command to force HTTP/1.1 fallback
2. **Check Network Overlay**: The network error overlay will show "HTTP/1.1 Fallback" status
3. **Verify Functionality**: Test that the app works normally with HTTP/1.1
4. **Monitor Recovery**: Watch for automatic attempts to reconnect to HTTP/2

## Status Indicators

### Network Error Overlay
- Shows "HTTP/1.1 Fallback" badge when using fallback protocol
- Displays helpful tip about protocol issues

### Console Logs
- `🔄 [ResilientSupabaseClient] Switching to HTTP/1.1 fallback client`
- `✅ [ResilientSupabaseClient] Successfully switched to HTTP/1.1 fallback client`
- `🔄 [ResilientSupabaseClient] Attempting to reconnect to primary HTTP/2 client`

## Configuration

The fallback system is configured with these defaults:

```typescript
{
  HTTP2_ERROR_THRESHOLD: 3,           // Switch after 3 HTTP/2 errors
  PROTOCOL_SWITCH_COOLDOWN: 30000,    // 30 seconds before retry
  HTTP2_ERRORS: [                     // Detected error types
    'ERR_HTTP2_PROTOCOL_ERROR',
    'ERR_HTTP2_STREAM_ERROR',
    'ERR_HTTP2_SESSION_ERROR',
    'HTTP2_HEADER_TIMEOUT',
    'HTTP2_SESSION_ERROR'
  ]
}
```

## Expected Behavior

### Before Fix
- Infinite loading states
- `ERR_HTTP2_PROTOCOL_ERROR` in console
- App becomes unusable during protocol errors

### After Fix
- Automatic fallback to HTTP/1.1 when HTTP/2 fails
- Continued app functionality with fallback protocol
- Clear user feedback about connection status
- Automatic recovery attempts when conditions improve

## Troubleshooting

If you're still experiencing issues:

1. **Check Console**: Look for HTTP/2 fallback logs
2. **Force Fallback**: Use `window.http2FallbackTest.test()` to manually trigger fallback
3. **Network Status**: Check the network error overlay for protocol information
4. **Clear Cache**: Clear browser cache and localStorage if needed

## Production Deployment

The HTTP/2 fallback system is production-ready and will:
- Automatically handle HTTP/2 protocol errors
- Provide seamless user experience during network issues
- Log all protocol switches for monitoring
- Attempt recovery when network conditions improve

No additional configuration is needed for production deployment.