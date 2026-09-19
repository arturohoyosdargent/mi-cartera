const assert=require('assert');const fs=require('fs');const path=require('path');
const src=fs.readFileSync(path.join(__dirname,'../app/operational-controller.js'),'utf8');
assert(src.includes("p.concept===F.CONCEPT.CAPITAL?Number(p.capitalAmount??p.amount):Number(p.capitalAmount||0)"),'capital report must include capitalAmount from installment payments');
assert(src.includes("p.concept===F.CONCEPT.INTEREST?Number(p.interestAmount??p.amount):Number(p.interestAmount||0)"),'interest report must include interestAmount from installment payments');
assert(src.includes("p.concept===F.CONCEPT.PENALTY?Number(p.penaltyAmount??p.amount):Number(p.penaltyAmount||0)"),'penalty report must preserve allocated penalty amounts');
assert(src.includes('totalCollected:money(capitalCollected+interestCollected+penaltyCollected)'),'total collected must reconcile allocated components');
console.log('report-installment-splits.spec.js PASS');
