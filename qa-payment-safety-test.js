const fs=require('fs'),vm=require('vm');
const code=fs.readFileSync('payment-safety-v1.js','utf8');
let registered=[];let toasts=[];let input={value:'30',max:'',dataset:{},focus(){}};
const credit={id:'cr1',total:100,paid:40,schedule:[{amount:25,paid:25},{amount:25,paid:0}]};
const document={getElementById(id){if(id==='payAmount')return input;if(id==='collectBody')return null;return null},createElement(){return {className:'',style:{},textContent:''}}};
const window={db:{credits:[credit]},money:n=>'S/'+Number(n).toFixed(2),currentDue:()=>0,openCollect:()=>{},registerPayment:id=>registered.push(id),toast:m=>toasts.push(m),document,setTimeout};
const sandbox={window,document,console,setTimeout};vm.createContext(sandbox);vm.runInContext(code,sandbox);
function ok(v,m){if(!v)throw new Error(m)}
// monto libre menor a cuota/saldo: debe pasar
input.value='10';window.registerPayment('cr1');ok(registered.length===1,'free partial payment must be accepted');
// monto distinto a cuota pero válido: debe pasar
input.value='37.50';window.registerPayment('cr1');ok(registered.length===2,'free non-installment payment must be accepted');
// sobrepago: debe bloquear y ajustar al saldo 60
input.value='80';window.registerPayment('cr1');ok(registered.length===2,'payment above remaining balance must be blocked');ok(input.value==='60.00','overpayment input must clamp to remaining balance');
// cero: bloqueado
input.value='0';window.registerPayment('cr1');ok(registered.length===2,'zero payment must be blocked');
// crédito inexistente: bloqueado
input.value='10';window.registerPayment('missing');ok(registered.length===2,'missing credit payment must be blocked');
console.log('PASS payment safety: free amounts accepted; zero, overpayment and missing credit blocked');
