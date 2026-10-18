import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createEmployer, type EmployerInsert, type EmployerUpdate, fetchEmployers, updateEmployer } from './api';

export const employerKeys = {
  all: ['employers'] as const,
  list: () => [...employerKeys.all, 'list'] as const,
};

export function useEmployers() {
  return useQuery({ queryKey: employerKeys.list(), queryFn: fetchEmployers });
}

function useInvalidateEmployers() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: employerKeys.all });
}

export function useCreateEmployer() {
  const invalidate = useInvalidateEmployers();
  return useMutation({ mutationFn: (values: EmployerInsert) => createEmployer(values), onSuccess: invalidate });
}

export function useUpdateEmployer() {
  const invalidate = useInvalidateEmployers();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: EmployerUpdate }) => updateEmployer(id, values),
    onSuccess: invalidate,
  });
}
