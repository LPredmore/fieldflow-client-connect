// Simple test to check Supabase connection
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://tizshsmrqqaharwpqocj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpenNoc21ycXFhaGFyd3Bxb2NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwOTQwNDQsImV4cCI6MjA3NDY3MDA0NH0.HFecGZAPLi6-RmPJrG0M0G9bAV7AsabybTapjKw-ddU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Testing Supabase connection...');

// Test basic connection
supabase.from('profiles').select('count').limit(1)
  .then(({ data, error }) => {
    if (error) {
      console.error('Connection test failed:', error);
    } else {
      console.log('Connection test successful:', data);
    }
  })
  .catch(err => {
    console.error('Connection test exception:', err);
  });

// Test authentication
console.log('Testing authentication...');
supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'testpassword'
}).then(({ data, error }) => {
  if (error) {
    console.log('Auth test (expected to fail):', error.message);
  } else {
    console.log('Auth test successful:', data);
  }
}).catch(err => {
  console.error('Auth test exception:', err);
});