export const consoleMockCallJoin = (type: 'log' | 'warn' | 'error' = 'log'): string => {
  const { calls }: { calls: string[][] } = (console[type] as any).mock;
  if (calls) return calls.map(sa => sa.join(' ')).join('\n');
  return '';
};
