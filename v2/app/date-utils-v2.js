// Mi Cartera PRO V2 — one date/balance interpretation for every operational view.
(function(root){'use strict';
const pad=n=>String(n).padStart(2,'0');
function localIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function valid(y,m,d){const date=new Date(Number(y),Number(m)-1,Number(d),12);return date.getFullYear()===Number(y)&&date.getMonth()===Number(m)-1&&date.getDate()===Number(d)?localIso(date):''}
function normalize(value){if(value==null||value==='')return '';if(typeof value?.toDate==='function')value=value.toDate();if(value&&typeof value==='object'&&value.seconds!=null)value=new Date(Number(value.seconds)*1000);if(value instanceof Date)return Number.isNaN(value.getTime())?'':localIso(value);const raw=String(value).trim();let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);if(m)return valid(m[1],m[2],m[3]);m=raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);if(m)return valid(m[3],m[2],m[1]);return ''}
function fromInstallment(row){return normalize(row?.date??row?.dueDate??row?.due_date??row?.installmentDate??row?.paymentDate??row?.fecha??row?.fechaPago??row?.fecha_vencimiento??row?.vencimiento??row?.scheduledDate)}
function today(){return localIso(new Date())}
function balance(row){return Math.max(0,Number(row?.balance??(Number(row?.amount||0)-Number(row?.paid||0))))}
function isPaid(row){return ['PAGADA','PAGADO','PAID'].includes(String(row?.status||'').toUpperCase())||balance(row)<=0}
function isDue(row,asOf=today()){const date=fromInstallment(row);return Boolean(date&&date<=asOf&&!isPaid(row))}
function isToday(row,asOf=today()){const date=fromInstallment(row);return Boolean(date&&date===asOf&&!isPaid(row))}
function isOverdue(row,asOf=today()){const date=fromInstallment(row);return Boolean(date&&date<asOf&&!isPaid(row))}
root.MiCarteraV2Dates={localIso,normalize,fromInstallment,today,balance,isPaid,isDue,isToday,isOverdue};
})(window);
