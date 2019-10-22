export const consoleMockCallJoin = (type: 'log' | 'warn' | 'error' = 'log'): string => {
  // @ts-ignore
  const { calls }: { calls: string[][] } = console[type].mock;
  if (calls) return calls.map(sa => sa.join(' ')).join('\n');
  return '';
};
