import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { LocaleRoot } from '@/app/locale-root';
import { planUnauthorizedRedirect } from '@/app/unauthorized-redirect';
import { setOnUnauthorized } from '@/shared/lib/api';
import { setupPwa } from '@/shared/lib/pwa';
import { createQueryClient } from '@/shared/lib/query-client';
import { router } from '@/router';
import '@/styles/app.css';

setupPwa();

const queryClient = createQueryClient();
router.update({ context: { queryClient } });

setOnUnauthorized((returnTo) => {
  const plan = planUnauthorizedRedirect(router.state.location.pathname, returnTo);
  if (plan) void router.navigate(plan);
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element missing in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Only the router/UI subtree remounts on a locale switch — the query
          client itself stays put so a language toggle never drops the cache. */}
      <LocaleRoot>
        <RouterProvider router={router} />
      </LocaleRoot>
    </QueryClientProvider>
  </StrictMode>,
);
