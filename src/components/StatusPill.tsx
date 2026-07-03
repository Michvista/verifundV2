type Props = {
  tone?: 'neutral' | 'success' | 'warn' | 'danger' | 'dark' | 'soft';
  children: string;
};

export function StatusPill({ tone = 'neutral', children }: Props) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
