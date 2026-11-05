import './style.css';

import { startPageRuntime } from '@/runtime';

// Extensions can't inject scripts into their own pages, so the demo page runs
// the page runtime itself. The side panel connects to it like to any page.
startPageRuntime();
