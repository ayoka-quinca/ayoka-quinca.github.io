import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, DEFAULT_COMPANY, type Company, type Sale } from '../db';
import { money, qty, dateShort, time, PAY_LABEL, waLink } from '../domain/format';
import { saleNet } from '../domain/ops';

export function useCompany(): Company {
  return useLiveQuery(() => getSetting<Company>('company', DEFAULT_COMPANY), []) ?? DEFAULT_COMPANY;
}

/** Ticket imprimable (imprimante thermique 58/80 mm ou A4 selon le réglage). */
export function Ticket({ sale, company, a4 }: { sale: Sale; company: Company; a4?: boolean }) {
  const net = saleNet(sale);
  return (
    <div className={`ticket ${a4 ? 'a4' : ''}`}>
      <div style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: '1.2em' }}>{company.name}</strong><br />
        {company.address}<br />Tél : {company.phone}{company.ifu ? <><br />IFU : {company.ifu}</> : null}
      </div>
      <hr />
      <div>{a4 ? 'FACTURE' : 'Ticket'} n° {sale.number}<br />{dateShort(sale.at)} {time(sale.at)}{sale.clientName ? <><br />Client : {sale.clientName}</> : null}</div>
      <hr />
      <table>
        <tbody>
          {sale.items.map((i, k) => (
            <tr key={k}>
              <td>{i.name}<br />{qty(i.qty - (i.returnedQty ?? 0))} {i.unit} × {money(i.unitPrice)}</td>
              <td className="r">{money((i.qty - (i.returnedQty ?? 0)) * i.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      <table>
        <tbody>
          <tr><td><strong>TOTAL</strong></td><td className="r"><strong>{money(net, 'FCFA')}</strong></td></tr>
          <tr><td>Payé ({PAY_LABEL[sale.method === 'credit' ? 'especes' : sale.method]})</td><td className="r">{money(sale.paid, 'FCFA')}</td></tr>
          {net - sale.paid > 0 && <tr><td>Reste à payer</td><td className="r">{money(net - sale.paid, 'FCFA')}</td></tr>}
        </tbody>
      </table>
      <hr />
      <div style={{ textAlign: 'center' }}>{company.footer}</div>
    </div>
  );
}

export function saleText(sale: Sale, company: Company): string {
  const net = saleNet(sale);
  const lines = sale.items.map((i) => `• ${i.name} : ${qty(i.qty - (i.returnedQty ?? 0))} ${i.unit} × ${money(i.unitPrice)} = ${money((i.qty - (i.returnedQty ?? 0)) * i.unitPrice)}`);
  return [
    `*${company.name}* – ${company.address}`,
    `Reçu n° ${sale.number} du ${dateShort(sale.at)} à ${time(sale.at)}`,
    '',
    ...lines,
    '',
    `*TOTAL : ${money(net, 'FCFA')}*`,
    `Payé : ${money(sale.paid, 'FCFA')}`,
    net - sale.paid > 0 ? `Reste à payer : ${money(net - sale.paid, 'FCFA')}` : '',
    '',
    company.footer,
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

export function shareSale(sale: Sale, company: Company, phone?: string) {
  window.open(waLink(phone, saleText(sale, company)), '_blank');
}
