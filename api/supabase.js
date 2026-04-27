    // ============================================================
// WEARIX — Supabase Client Config
// ============================================================

const SUPABASE_URL = 'https://jtprrhppsleunzjbolbp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0cHJyaHBwc2xldW56amJvbGJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Nzc1MjIsImV4cCI6MjA5MjM1MzUyMn0.OvXO8H2rHK9FIDB0nYpnxf1xMdLwlfqAi_8ihRADFZE';

// Separate Supabase connection for messages/chat only
const MESSAGES_SUPABASE_URL = 'https://bwpwarevjqwtmhusznza.supabase.co';
const MESSAGES_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3cHdhcmV2anF3dG1odXN6bnphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NTkyNjAsImV4cCI6MjA5MjQzNTI2MH0.vKZ4OCUSNh91fK8kXVDJQD2Yxv-O5H7w3pjgViR1JP0';

// Load Supabase via CDN (added to each HTML page via <script> tag)
// This file is loaded AFTER the CDN script so `supabase` global is available

const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create separate client for messages
const messagesDb = createClient(MESSAGES_SUPABASE_URL, MESSAGES_SUPABASE_ANON_KEY);
