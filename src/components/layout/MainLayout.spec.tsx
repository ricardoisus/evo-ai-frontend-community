import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Settings } from 'lucide-react';
import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

vi.mock('../../hooks/useLanguage', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Test', role: { key: 'admin' } },
    logout: vi.fn(),
  }),
}));

vi.mock('@/contexts/PermissionsContext', () => ({
  usePermissions: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}));

vi.mock('@/hooks/useDashboardApps', () => ({
  useDashboardApps: () => ({ apps: [] }),
}));

vi.mock('@/utils/injectDashboardApps', () => ({
  injectDashboardAppsIntoMenu: (items: unknown[]) => items,
}));

vi.mock('./config/menuItems', () => ({
  getCustomerMenuItems: () => [],
  filterMenuItemsByPermissions: (items: unknown[]) => items,
}));

vi.mock('./components', () => ({
  Header: () => <div data-testid="header" />,
  Sidebar: () => <div data-testid="sidebar" />,
}));

vi.mock('@/components/WelcomeTourModal', () => ({
  WelcomeTourModal: () => null,
}));

vi.mock('sonner', () => ({
  toast: { loading: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

vi.mock('@evoapi/design-system', () => ({
  Button: ({ children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...props}>{children}</button>
  ),
  Dialog: ({ children }: PropsWithChildren) => <>{children}</>,
  DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogDescription: ({ children }: PropsWithChildren) => <div>{children}</div>,
  DialogFooter: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

const mockUseMenuState = vi.hoisted(() => vi.fn());
const mockSetActiveSubmenu = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useMenuState', () => ({
  useMenuState: mockUseMenuState,
}));

const settingsItem = {
  id: 'settings',
  name: 'Settings',
  href: '#',
  icon: Settings,
  subItems: [],
};

const defaultMenuState = () => ({
  activeSubmenu: settingsItem,
  activeMenu: null,
  setActiveSubmenu: mockSetActiveSubmenu,
  setActiveMenu: vi.fn(),
  isMenuItemActive: () => false,
  isMenuWithSubItemsActive: () => false,
  handleMenuClick: vi.fn(),
  resetManualFlag: vi.fn(),
});

import MainLayout from './MainLayout';

describe('MainLayout — authenticated shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('sidebar-collapsed', 'true');
    mockUseMenuState.mockReturnValue(defaultMenuState());
  });

  function renderLayout() {
    return render(
      <MemoryRouter>
        <MainLayout>
          <div data-testid="content">Content</div>
        </MainLayout>
      </MemoryRouter>,
    );
  }

  it('applies the authenticated density class and removes it on unmount', () => {
    const view = renderLayout();
    expect(document.body).toHaveClass('authenticated-panel-density');
    view.unmount();
    expect(document.body).not.toHaveClass('authenticated-panel-density');
  });

  it('renders the compensated authenticated shell', () => {
    renderLayout();
    expect(screen.getByTestId('content').closest('.authenticated-shell')).toBeInTheDocument();
  });

  it('does not overlay the content when a collapsed sidebar submenu is open', () => {
    renderLayout();
    expect(screen.queryByRole('button', { name: 'sidebar.closeSubmenu' })).not.toBeInTheDocument();
  });

  it('does not render backdrop when sidebar is expanded', () => {
    localStorage.setItem('sidebar-collapsed', 'false');
    renderLayout();
    expect(screen.queryByRole('button', { name: 'sidebar.closeSubmenu' })).not.toBeInTheDocument();
  });

  it('does not render backdrop when activeSubmenu is null', () => {
    mockUseMenuState.mockReturnValue({ ...defaultMenuState(), activeSubmenu: null });
    renderLayout();
    expect(screen.queryByRole('button', { name: 'sidebar.closeSubmenu' })).not.toBeInTheDocument();
  });
});
