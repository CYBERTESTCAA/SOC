import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TimeRange = '1h' | '12h' | '24h' | '7d' | '30d' | 'custom';
export type Workload = 'defender' | 'entra' | 'intune' | 'exchange';

export interface GlobalFilters {
  timeRange: TimeRange;
  customStartDate?: Date;
  customEndDate?: Date;
  workloads: Workload[];
  severities: string[];
  assignedToMe: boolean;
  unassignedOnly: boolean;
  slaBreachOnly: boolean;
}

interface GlobalFilterContextType {
  filters: GlobalFilters;
  setTimeRange: (range: TimeRange) => void;
  setCustomDateRange: (start: Date, end: Date) => void;
  toggleWorkload: (workload: Workload) => void;
  setWorkloads: (workloads: Workload[]) => void;
  toggleSeverity: (severity: string) => void;
  setSeverities: (severities: string[]) => void;
  setAssignedToMe: (value: boolean) => void;
  setUnassignedOnly: (value: boolean) => void;
  setSlaBreachOnly: (value: boolean) => void;
  resetFilters: () => void;
  getTimeRangeDate: () => Date;
}

const defaultFilters: GlobalFilters = {
  timeRange: '24h',
  workloads: ['defender', 'entra', 'intune', 'exchange'],
  severities: [],
  assignedToMe: false,
  unassignedOnly: false,
  slaBreachOnly: false,
};

const GlobalFilterContext = createContext<GlobalFilterContextType | undefined>(undefined);

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<GlobalFilters>(defaultFilters);

  const setTimeRange = (range: TimeRange) => {
    setFilters(prev => ({ ...prev, timeRange: range }));
  };

  const setCustomDateRange = (start: Date, end: Date) => {
    setFilters(prev => ({
      ...prev,
      timeRange: 'custom',
      customStartDate: start,
      customEndDate: end,
    }));
  };

  const toggleWorkload = (workload: Workload) => {
    setFilters(prev => ({
      ...prev,
      workloads: prev.workloads.includes(workload)
        ? prev.workloads.filter(w => w !== workload)
        : [...prev.workloads, workload],
    }));
  };

  const setWorkloads = (workloads: Workload[]) => {
    setFilters(prev => ({ ...prev, workloads }));
  };

  const toggleSeverity = (severity: string) => {
    setFilters(prev => ({
      ...prev,
      severities: prev.severities.includes(severity)
        ? prev.severities.filter(s => s !== severity)
        : [...prev.severities, severity],
    }));
  };

  const setSeverities = (severities: string[]) => {
    setFilters(prev => ({ ...prev, severities }));
  };

  const setAssignedToMe = (value: boolean) => {
    setFilters(prev => ({ ...prev, assignedToMe: value, unassignedOnly: value ? false : prev.unassignedOnly }));
  };

  const setUnassignedOnly = (value: boolean) => {
    setFilters(prev => ({ ...prev, unassignedOnly: value, assignedToMe: value ? false : prev.assignedToMe }));
  };

  const setSlaBreachOnly = (value: boolean) => {
    setFilters(prev => ({ ...prev, slaBreachOnly: value }));
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const getTimeRangeDate = (): Date => {
    const now = new Date();
    switch (filters.timeRange) {
      case '1h': return new Date(now.getTime() - 1 * 60 * 60 * 1000);
      case '12h': return new Date(now.getTime() - 12 * 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'custom': return filters.customStartDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  };

  return (
    <GlobalFilterContext.Provider
      value={{
        filters,
        setTimeRange,
        setCustomDateRange,
        toggleWorkload,
        setWorkloads,
        toggleSeverity,
        setSeverities,
        setAssignedToMe,
        setUnassignedOnly,
        setSlaBreachOnly,
        resetFilters,
        getTimeRangeDate,
      }}
    >
      {children}
    </GlobalFilterContext.Provider>
  );
}

export function useGlobalFilters() {
  const context = useContext(GlobalFilterContext);
  if (!context) {
    throw new Error('useGlobalFilters must be used within a GlobalFilterProvider');
  }
  return context;
}
