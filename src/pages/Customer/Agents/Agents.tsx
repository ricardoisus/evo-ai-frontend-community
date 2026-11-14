import { catalog, type ManagedAgent } from '@/services/agents/vetorialService';
import { ManagedAgents, LoadState, Notice } from '@/components/agents/vetorial/Shared';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@evoapi/design-system';
import {
  AgentsTable,
  AgentsHeader,
  AgentsPagination,
  AgentWizardModal,
  AgentsFilter,
} from '@/components/agents';
import { EmptyState } from '@/components/base';
import { Bot, Search } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/PermissionsContext';
import { deleteAgent } from '@/services/agents';
import { Agent, AGENT_FILTER_TYPES } from '@/types/agents';
import { buildAppliedFilterChips } from '@/utils/appliedFilterChips';
import type { BaseFilter, AppliedFilter } from '@/types/core';
import { useLanguage } from '@/hooks/useLanguage';
import { ApiKeysModal } from '@/components/ApiKeysModal';
import { AgentsTour } from '@/tours';
import { useDarkMode } from '@/hooks/useDarkMode';
import type { PaginationMeta } from '@/types/core';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';

interface AgentsState {
  agents: Agent[];
  selectedAgents: Agent[];
  meta: {
    pagination: PaginationMeta;
  };
  loading: boolean;
}

const INITIAL_STATE: AgentsState = {
  agents: [],
  selectedAgents: [],
  meta: {
    pagination: {
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
      total: 0,
      total_pages: 0,
    },
  },
  loading: false,
};

const Agentes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage('agents');
  const { can, isReady: permissionsReady, loading: permissionsLoading } = usePermissions();
  useDarkMode();

  const [managed, setManaged] = useState<ManagedAgent[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [managedFiltersOpen, setManagedFiltersOpen] = useState(false);
  const [managedMode, setManagedMode] = useState('');
  const [managedHealth, setManagedHealth] = useState('');
  const [catalogSource, setCatalogSource] = useState('');
  const requestSequence = useRef(0);
  const [partial, setPartial] = useState(false);
  const [state, setState] = useState<AgentsState>(INITIAL_STATE);
  const [isApiKeysModalOpen, setIsApiKeysModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<BaseFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  // EVO-1952: ref synced to activeFilters so the applied-chip "x" removes against
  // the current list, not the stale snapshot captured when the chips were built.
  const activeFiltersRef = useRef<BaseFilter[]>([]);
  activeFiltersRef.current = activeFilters;

  const loadingRef = useRef(false);
  const loadAgentsRef = useRef<
    ((params?: { page?: number; per_page?: number }) => Promise<void>) | null
  >(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isWizardOpen = location.pathname === '/agents/new';

  const loadAgents = useCallback(
    async (params?: { page?: number; per_page?: number }, filtersOverride?: BaseFilter[]) => {
      if (permissionsLoading || !permissionsReady) {
        return;
      }

      if (!can('ai_agents', 'read')) {
        toast.error(t('permissions.viewDenied'));
        return;
      }

      const sequence = ++requestSequence.current;
      loadingRef.current = true;
      setState(prev => ({ ...prev, loading: true }));

      try {
        const currentPage = params?.page ?? 1;
        const currentPageSize = params?.per_page ?? 24;

        const effectiveFilters = filtersOverride ?? activeFilters;
        const filterParams = effectiveFilters.reduce(
          (acc, filter, index) => {
            const prefix = `filters[${index}]`;
            acc[`${prefix}[attribute_key]`] = filter.attributeKey;
            acc[`${prefix}[filter_operator]`] = filter.filterOperator;
            acc[`${prefix}[values]`] = Array.isArray(filter.values)
              ? filter.values.join(',')
              : String(filter.values);
            if (index > 0) {
              acc[`${prefix}[query_operator]`] = filter.queryOperator;
            }
            return acc;
          },
          {} as Record<string, string>,
        );

        const result = await catalog(currentPage, currentPageSize, {
          ...filterParams,
          ...(searchTerm ? { search: searchTerm } : {}),
          ...(managedMode ? { mode: managedMode } : {}),
          ...(managedHealth ? { health: managedHealth } : {}),
          ...(catalogSource ? { source: catalogSource } : {}),
        });
        if (sequence !== requestSequence.current) return;
        setManaged(result.data.managed);
        setPartial(result.meta.partial);
        setCatalogError('');
        const response = result.data.native || {
          data: [],
          meta: {
            pagination: {
              total: 0,
              page_size: currentPageSize,
              page: currentPage,
              total_pages: 0,
              has_next_page: false,
              has_previous_page: false,
            },
          },
        };

        const pagination =
          response.meta?.pagination || (response.meta as unknown as PaginationMeta);
        const total = pagination?.total || 0;
        const pageSize = pagination?.page_size || DEFAULT_PAGE_SIZE;

        const agentsData: Agent[] = Array.isArray(response.data)
          ? response.data.length > 0 && Array.isArray(response.data[0])
            ? (response.data as unknown as Agent[][]).flat()
            : (response.data as unknown as Agent[])
          : [];

        setState(prev => ({
          ...prev,
          agents: agentsData,
          meta: {
            pagination: {
              page: pagination?.page || currentPage,
              page_size: pageSize,
              total,
              total_pages: pagination?.total_pages || Math.ceil(total / pageSize),
              has_next_page: pagination?.has_next_page,
              has_previous_page: pagination?.has_previous_page,
            },
          },
          loading: false,
        }));
      } catch (error) {
        if (sequence !== requestSequence.current) return;
        console.error('Erro ao carregar agentes:', error);
        setCatalogError('Não foi possível carregar os agentes.');
        setManaged([]);
        setState(prev => ({ ...prev, agents: [], selectedAgents: [] }));
        setState(prev => ({ ...prev, loading: false }));
      } finally {
        loadingRef.current = false;
      }
    },
    [
      permissionsReady,
      permissionsLoading,
      can,
      t,
      activeFilters,
      searchTerm,
      managedMode,
      managedHealth,
      catalogSource,
    ],
  );

  useEffect(() => {
    loadAgentsRef.current = loadAgents;
  }, [loadAgents]);

  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    if (loadAgentsRef.current) {
      loadAgentsRef.current();
    }
  }, [permissionsReady, permissionsLoading]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAgentsRef.current?.();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, managedMode, managedHealth, catalogSource]);

  const handleCreateAgent = () => {
    if (!can('ai_agents', 'create')) {
      toast.error(t('permissions.createDenied'));
      return;
    }
    navigate('/agents/new');
  };

  const handleEditAgent = (agentId: string) => {
    if (!can('ai_agents', 'update')) {
      toast.error(t('permissions.editDenied'));
      return;
    }
    navigate(`/agents/${agentId}/edit`);
  };

  const handleDeleteAgent = (agent: Agent) => {
    if (!can('ai_agents', 'delete')) {
      toast.error(t('permissions.deleteDenied'));
      return;
    }
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      setIsDeleting(true);
      await deleteAgent(agentToDelete.id);

      setState(prev => ({
        ...prev,
        agents: prev.agents.filter(a => a.id !== agentToDelete.id),
        meta: {
          ...prev.meta,
          pagination: {
            ...prev.meta.pagination,
            total: Math.max(0, prev.meta.pagination.total - 1),
            total_pages: Math.ceil(
              Math.max(0, prev.meta.pagination.total - 1) / prev.meta.pagination.page_size,
            ),
          },
        },
      }));

      toast.success(t('deleteDialog.success', { name: agentToDelete.name }));
      setDeleteDialogOpen(false);
      setAgentToDelete(null);
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      setCatalogError('Não foi possível carregar os agentes.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSort = (column: string) => {
    const newOrder = sortBy === column && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortBy(column);
    setSortOrder(newOrder);
  };

  const handlePageChange = (page: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page },
      },
      selectedAgents: [],
    }));

    loadAgents({ page });
  };

  const handlePerPageChange = (perPage: number) => {
    setState(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        pagination: { ...prev.meta.pagination, page_size: perPage, page: 1 },
      },
      selectedAgents: [],
    }));

    loadAgents({ page: 1, per_page: perPage });
  };

  const handleBulkDelete = () => {
    toast.info(t('bulkDelete'));
  };

  const convertFiltersToApplied = (filters: BaseFilter[]): AppliedFilter[] =>
    buildAppliedFilterChips(filters, AGENT_FILTER_TYPES, t, handleRemoveFilter);

  const handleOpenFilter = () => setFilterModalOpen(true);

  const handleApplyFilters = (filters: BaseFilter[]) => {
    setActiveFilters(filters);
    setAppliedFilters(convertFiltersToApplied(filters));
    loadAgents({ page: 1 }, filters);
  };

  const handleClearFilters = () => {
    setActiveFilters([]);
    setAppliedFilters([]);
    loadAgents({ page: 1 }, []);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = activeFiltersRef.current.filter((_, i) => i !== index);
    if (newFilters.length === 0) {
      handleClearFilters();
    } else {
      handleApplyFilters(newFilters);
    }
  };

  const filteredAgents = state.agents.filter(
    agent =>
      agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const managedFilters = (
    <div className="va-row" aria-label="Filtros de agentes gerenciados">
      <label>
        Origem{' '}
        <select
          aria-label="Origem do agente"
          value={catalogSource}
          onChange={e => setCatalogSource(e.target.value)}
        >
          <option value="">Todas</option>
          <option value="vetorial_runtime">Vetorial</option>
          <option value="core">Nativos</option>
        </select>
      </label>
      <label>
        Modo{' '}
        <select
          aria-label="Modo dos agentes"
          value={managedMode}
          onChange={e => setManagedMode(e.target.value)}
        >
          <option value="">Todos os modos</option>
          <option value="off">Desligado</option>
          <option value="pilot">Piloto</option>
          <option value="all">Todos</option>
        </select>
      </label>
      <label>
        Saúde{' '}
        <select
          aria-label="Saúde dos agentes"
          value={managedHealth}
          onChange={e => setManagedHealth(e.target.value)}
        >
          <option value="">Todos os estados</option>
          <option value="healthy">Saudável</option>
          <option value="delayed">Atrasado</option>
          <option value="unavailable">Indisponível</option>
          <option value="awaiting_configuration">Aguardando configuração</option>
        </select>
      </label>
    </div>
  );
  return (
    <div className="flex flex-col h-full">
      {isWizardOpen ? (
        <div className="flex-1 min-h-0 animate-slideInFromRight">
          <AgentWizardModal
            embedded
            open={isWizardOpen}
            onOpenChange={open => {
              if (!open) {
                navigate('/agents/list');
              }
            }}
            onAgentCreated={() => {
              loadAgents();
            }}
          />
        </div>
      ) : (
        <div className="animate-fadeIn h-full flex flex-col">
          <AgentsTour />
          <div className="flex-1 space-y-6 p-6">
            <div data-tour="agents-header">
              <AgentsHeader
                totalCount={
                  state.meta.pagination.total +
                  managed.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .length
                }
                selectedCount={state.selectedAgents.length}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                onNewAgent={handleCreateAgent}
                onManageApiKeys={() => setIsApiKeysModalOpen(true)}
                onBulkDelete={handleBulkDelete}
                onClearSelection={() => setState(prev => ({ ...prev, selectedAgents: [] }))}
                onFilter={() =>
                  window.matchMedia('(max-width: 640px)').matches
                    ? setManagedFiltersOpen(true)
                    : handleOpenFilter()
                }
                activeFilters={appliedFilters}
                showFilters={true}
              />
            </div>

            <div className="va-desktop-filters">{managedFilters}</div>
            <Sheet open={managedFiltersOpen} onOpenChange={setManagedFiltersOpen}>
              <SheetContent className="va-filter-sheet">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                  <SheetDescription>Filtre os agentes por origem, modo e saúde.</SheetDescription>
                </SheetHeader>
                {managedFilters}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setManagedFiltersOpen(false);
                    handleOpenFilter();
                  }}
                >
                  Filtros do catálogo Evo
                </Button>
                <Button onClick={() => setManagedFiltersOpen(false)}>Concluir</Button>
              </SheetContent>
            </Sheet>
            <AgentsFilter
              open={filterModalOpen}
              onOpenChange={setFilterModalOpen}
              filters={activeFilters}
              onFiltersChange={setActiveFilters}
              onApplyFilters={handleApplyFilters}
              onClearFilters={handleClearFilters}
            />

            <div data-tour="agents-list">
              {catalogError && <LoadState error={catalogError} retry={() => loadAgents()} />}
              {partial && (
                <Notice retry={() => void loadAgents()}>
                  Alguns agentes estão indisponíveis. Os agentes Vetorial continuam acessíveis.{' '}
                </Notice>
              )}
              {!state.loading && (
                <ManagedAgents
                  agents={managed.filter(a =>
                    a.name.toLowerCase().includes(searchTerm.toLowerCase()),
                  )}
                />
              )}

              {catalogError ? null : state.loading ? (
                <LoadState />
              ) : state.agents.length === 0 && managed.length > 0 ? null : state.agents.length ===
                0 ? (
                <EmptyState
                  icon={Bot}
                  title={t('emptyState.title')}
                  description={t('emptyState.description')}
                  action={{
                    label: t('createAgent'),
                    onClick: handleCreateAgent,
                  }}
                />
              ) : filteredAgents.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title={t('emptyState.noResults')}
                  description={t('search.noResults')}
                  action={{
                    label: t('search.clearSearch'),
                    onClick: () => setSearchTerm(''),
                    variant: 'outline',
                  }}
                />
              ) : (
                <AgentsTable
                  agents={filteredAgents}
                  selectedAgents={state.selectedAgents}
                  loading={state.loading}
                  onSelectionChange={agents =>
                    setState(prev => ({ ...prev, selectedAgents: agents }))
                  }
                  onEditAgent={agent => handleEditAgent(agent.id)}
                  onDeleteAgent={handleDeleteAgent}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              )}
            </div>
          </div>

          <div className="p-6 pt-0">
            <AgentsPagination
              currentPage={state.meta.pagination.page}
              totalPages={state.meta.pagination.total_pages}
              totalCount={state.meta.pagination.total}
              perPage={state.meta.pagination.page_size}
              onPageChange={handlePageChange}
              onPerPageChange={handlePerPageChange}
              loading={state.loading}
            />
          </div>
        </div>
      )}

      <ApiKeysModal open={isApiKeysModalOpen} onOpenChange={setIsApiKeysModalOpen} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description', { name: agentToDelete?.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDeleteAgent} disabled={isDeleting}>
              {isDeleting ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agentes;
