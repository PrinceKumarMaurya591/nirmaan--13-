import React from 'react';
import { Project } from '../types';

interface PDFReportProps {
  project: Project;
  totalExpenses: number;
  currentProfit: number;
  vendorLedgerData: any[];
  pettyCashData: any[];
  laborData: any[];
  subcontractorData: any[];
  miscDocsData: any[];
  advanceData?: any[];
}

export const PDFReport: React.FC<PDFReportProps> = ({
  project,
  totalExpenses,
  currentProfit,
  vendorLedgerData,
  pettyCashData,
  laborData,
  subcontractorData,
  miscDocsData,
  advanceData
}) => {
  const formatINR = (amount: number) => {
    return '₹ ' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount);
  };

  const approvedExpenses = (project.expenseItems || []).filter(e => e.status === 'Approved' && !e.isDeleted);
  
  const materialExpenses = approvedExpenses.filter(e => e.category === 'material');
  const consumedMaterialExpenses = approvedExpenses.filter(e => e.category === 'consumed_material');
  const shiftingExpenses = approvedExpenses.filter(e => e.category === 'shifting');
  const machineryExpenses = approvedExpenses.filter(e => e.category === 'machinery');
  const laborExpensesCategory = approvedExpenses.filter(e => e.category === 'labor');
  const miscExpenses = approvedExpenses.filter(e => e.category === 'misc');

  const receipts = (project.receiptsHistory || []).filter(r => !r.isDeleted);
  const totalReceived = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);

  // Reusable expense table renderer
  const renderExpenseTable = (title: string, items: any[], showVehicle = false, showVendor = false) => {
    if (items.length === 0) return null;
    
    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    return (
      <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{title}</span>
          <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#475569' }}>Subtotal: {formatINR(totalAmount)}</span>
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '80px' }}>Date</th>
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Item Description</th>
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '70px' }}>Quantity</th>
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '70px' }}>Rate</th>
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '80px' }}>Amount</th>
              {showVendor && <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Vendor/Party</th>}
              {showVehicle && <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Vehicle/Details</th>}
              <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '85px' }}>Paid By</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{item.date}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{item.itemName}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  {item.vendorQuantity !== undefined && item.vendorQuantity !== null && String(item.vendorQuantity).trim() !== "" && Number(item.vendorQuantity) !== 0 && item.vendorUnit ? `${item.vendorQuantity} ${item.vendorUnit}` : item.quantity}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                  {item.vendorRate !== undefined && item.vendorRate !== null && String(item.vendorRate).trim() !== "" && Number(item.vendorRate) !== 0 && item.vendorUnit ? `${formatINR(item.vendorRate)} / ${item.vendorUnit}` : formatINR(item.rate || 0)}
                </td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatINR(item.amount || 0)}</td>
                {showVendor && <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{item.vendor || 'N/A'}</td>}
                {showVehicle && <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{item.vehicleNo || item.shifterName || 'N/A'}</td>}
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textTransform: 'capitalize' }}>
                  {(item.paidBy || 'N/A').replace('_', ' ')}
                </td>
              </tr>
            ))}
            <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total {title}</td>
              <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(totalAmount)}</td>
              <td colSpan={(showVendor ? 1 : 0) + (showVehicle ? 1 : 0) + 1} style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', color: '#0f172a' }}>
      {/* Header section */}
      <div style={{ backgroundColor: '#0f172a', color: 'white', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>{project.name || 'Project Statement'}</h1>
        <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
          <p style={{ margin: '4px 0' }}><strong>Location:</strong> {project.location || 'N/A'}</p>
          <p style={{ margin: '4px 0' }}><strong>Incharge:</strong> {project.incharge || 'N/A'}</p>
          <p style={{ margin: '4px 0' }}><strong>Scheme:</strong> {project.scheme || 'N/A'}</p>
          <p style={{ margin: '4px 0' }}><strong>Department:</strong> {project.department || 'N/A'}</p>
          <p style={{ margin: '4px 0' }}><strong>Date Generated:</strong> {new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Financial Overview Card */}
      <h2 style={{ fontSize: '16px', marginBottom: '10px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Financial Overview</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
            <th style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1' }}>Key Indicator</th>
            <th style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', textAlign: 'right' }}>Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1' }}>Total Work Order Value</td>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'right' }}>{formatINR(project.woValue || 0)}</td>
          </tr>
          <tr>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1' }}>Total Fund Received</td>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#16a34a', textAlign: 'right' }}>{formatINR(project.received || 0)}</td>
          </tr>
          <tr>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1' }}>Total Project Expenses</td>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#ef4444', textAlign: 'right' }}>{formatINR(totalExpenses || 0)}</td>
          </tr>
          <tr style={{ backgroundColor: '#f8fafc' }}>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>Remaining Profit / Balance</td>
            <td style={{ padding: '10px 14px', boxSizing: 'border-box', lineHeight: 'normal', wordBreak: 'break-word', verticalAlign: 'middle', border: '1px solid #cbd5e1', fontWeight: 'bold', color: currentProfit >= 0 ? '#16a34a' : '#ef4444', textAlign: 'right' }}>{formatINR(currentProfit || 0)}</td>
          </tr>
        </tbody>
      </table>

      {/* Petty Cash Funds Received History */}
      {receipts.length > 0 && (
        <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Funds Received History (Petty Cash Receipts)</span>
            <span style={{ fontSize: '12px', fontWeight: 'normal', color: '#475569' }}>Total Received: {formatINR(totalReceived)}</span>
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '100px' }}>Date</th>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '120px' }}>Amount Received</th>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Note / Details</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{receipt.date}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold', color: '#16a34a' }}>{formatINR(receipt.amount || 0)}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{receipt.note || 'N/A'}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Total Funds</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', color: '#16a34a' }}>{formatINR(totalReceived)}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Material Expenses */}
      {renderExpenseTable("Material Expenses", materialExpenses, false, true)}

      {/* Consumed Material */}
      {renderExpenseTable("Consumed Material (Consumption)", consumedMaterialExpenses, false, true)}

      {/* Shifting Expenses */}
      {renderExpenseTable("Shifting & Logistics", shiftingExpenses, true, false)}

      {/* Machinery Expenses */}
      {renderExpenseTable("Machinery Expenses", machineryExpenses, false, true)}

      {/* Other direct Labor Expenses (if any) */}
      {renderExpenseTable("Labor Expenses (Direct Payments)", laborExpensesCategory, false, false)}

      {/* Miscellaneous Expenses */}
      {renderExpenseTable("Miscellaneous Expenses", miscExpenses, false, false)}

      {/* Labor Wages & Attendance Ledger */}
      {laborData.length > 0 && (
         <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
           <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Labour Attendance & Wages Ledger</h2>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Name</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Type</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '70px' }}>Total Days</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Total Wages</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Advances Paid</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {laborData.map((l, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{l.name}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{l.type}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{l.totalDays}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(l.totalWages || 0)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(l.advances || 0)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatINR(l.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
      )}

      {/* Staff & Labor Advances */}
      {advanceData && advanceData.length > 0 && (
         <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
           <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Staff & Labour Advances History</h2>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '80px' }}>Date</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Person Name</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>Amount</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left', width: '100px' }}>Paid By</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {advanceData.map((adv, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{adv.date}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{adv.personName}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatINR(adv.amount || 0)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{adv.paidBy}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{adv.note || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
      )}

      {/* Subcontractor Ledger */}
      {subcontractorData && subcontractorData.length > 0 && (
         <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
           <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Subcontractors Progress & Payments</h2>
           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9' }}>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Subcontractor</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Work Description</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Total Earned</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Total Paid</th>
                   <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '90px' }}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {subcontractorData.map((sub, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{sub.name}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{sub.workDescription}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(sub.workValue || 0)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(sub.totalPaid || 0)}</td>
                    <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatINR(sub.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
           </table>
         </div>
      )}

      {/* Supplier Ledger Summary */}
      {vendorLedgerData.length > 0 && (
        <div style={{ pageBreakInside: 'avoid', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '15px', marginBottom: '8px', color: '#0f172a', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px' }}>Supplier / Material Ledger Summary</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'left' }}>Vendor Name</th>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>Total Billed</th>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>Total Paid</th>
                <th style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', width: '100px' }}>Balance Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {vendorLedgerData.map((v, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1' }}>{v.vendorName}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(v.totalBilled || 0)}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatINR(v.totalPaid || 0)}</td>
                  <td style={{ padding: '6px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>{formatINR(v.balance || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
