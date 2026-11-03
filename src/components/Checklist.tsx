import type { CheckItem } from '@/lib/venues';
import { IconCheck, IconX } from './icons';

export function Checklist({ items }: { items: CheckItem[] }) {
  return (
    <ul className="checklist">
      {items.map((i) => (
        <li key={i.key} data-state={i.state}>
          <span className={`mark ${i.state}`}>
            {i.state === 'ok' ? <IconCheck size={14} /> : i.state === 'ko' ? <IconX size={14} /> : <span style={{ fontWeight: 800, fontSize: 13 }}>i</span>}
          </span>
          <span>
            <b>{i.label}</b>
            <small>{i.detail}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
