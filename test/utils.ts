export const consoleMockCallJoin = (type: 'log' | 'warn' | 'error' = 'log'): string => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const { calls }: { calls: string[][] } = console[type].mock;
  if (calls) return calls.map(sa => sa.join(' ')).join('\n');
  return '';
};
