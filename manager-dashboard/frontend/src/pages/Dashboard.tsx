import { useState, useEffect } from 'react';
import { Sidebar, SidebarItem } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
//import { CheckBox } from "@/components/ui/checkbox";

interface FormData {
  No: number;
  'Employee Name': string;
  'Requester Name': string;
  'Request Date': string;
  'Service Week': string;
  'Total Hours': number;
}

interface CountData {
  pending: number;
  approved: number;
  confirmed: number;
  past_2months: number;
}

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [forms, setForms] = useState<FormData[]>([]);
  const [selectedForms, setSelectedForms] = useState<number[]>([]);
  const [counts, setCounts] = useState<CountData>({ pending: 0, approved: 0, confirmed: 0, past_2months: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const url = activeTab === 'past_2months' 
          ? 'http://44.222.140.196:8000/dashboard'
          : `http://44.222.140.196:8000/dashboard?status=${activeTab}`;
        
        const response = await fetch(url);
        const data = await response.json();
        console.log('Fetched data:', data);
        
        setForms(data.forms);
        setCounts(data.counts);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  // Select All 핸들러 추가
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedForms(forms.map(form => form.No));
    } else {
      setSelectedForms([]);
    }
  };

  // 개별 선택 핸들러 추가
  const handleSelectOne = (formNo: number) => {
    setSelectedForms(prev => 
      prev.includes(formNo)
        ? prev.filter(id => id !== formNo)
        : [...prev, formNo]
    );
  };

  const handleApprove = async () => {
    if (selectedForms.length === 0) return;
  
    try {
      const response = await fetch('http://44.222.140.196:8000/approve-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ form_ids: selectedForms })  // 형식 수정
      });

      if (!response.ok) {
        throw new Error('Failed to approve forms');
      }

      // 성공적으로 승인되면 데이터 다시 불러오기
      const updatedResponse = await fetch(`http://44.222.140.196:8000/dashboard?status=${activeTab}`);
      const data = await updatedResponse.json();
      setForms(data.forms);
      setCounts(data.counts);
      
      // 선택 초기화
      setSelectedForms([]);
      
      // 성공 메시지 표시 (선택사항)
      alert('Selected forms have been approved successfully');
      
    } catch (error) {
      console.error('Error approving forms:', error);
      alert('Failed to approve forms. Please try again.');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // PDF 병합 미리보기 요청
      const response = await fetch('http://44.222.140.196:8000/forms/merge-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedForms)
      });

      if (!response.ok) {
        throw new Error('Failed to merge PDFs');
      }

      // PDF 블롭 생성
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);

    } catch (error) {
      console.error('Error:', error);
      // 에러 처리 (예: toast 메시지)
    }
  };

  const handleDownloadMergedPDF = () => {
    if (previewUrl) {
      const a = document.createElement('a');
      a.href = previewUrl;
      a.download = 'merged_forms.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Delete(Reject) 핸들러 수정
  const handleReject = async () => {
    if (selectedForms.length === 0) return;
  
    try {
      // 선택된 각 폼에 대해 reject API 호출
      const rejectPromises = selectedForms.map(formId => 
        fetch(`http://44.222.140.196:8000/forms/${formId}/reject`, {
          method: 'PUT'
        })
      );

      await Promise.all(rejectPromises);

      // 데이터 다시 불러오기
      const updatedResponse = await fetch(`http://44.222.140.196:8000/dashboard?status=${activeTab}`);
      const data = await updatedResponse.json();
      setForms(data.forms);
      setCounts(data.counts);
      
      // 선택 초기화
      setSelectedForms([]);
      
      alert('Selected forms have been rejected successfully');
      
    } catch (error) {
      console.error('Error rejecting forms:', error);
      alert('Failed to reject forms. Please try again.');
    }
  };

  // Confirm 핸들러 수정
  const handleConfirm = async () => {
    if (selectedForms.length === 0) return;
  
    try {
      // 1. PDF 다운로드
      const response = await fetch('http://44.222.140.196:8000/forms/merge-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ form_ids: selectedForms })
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      // PDF blob을 URL로 변환하여 미리보기 상태 업데이트
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setPdfUrl(url);

      // 2. 상태를 confirmed로 변경
      const confirmPromises = selectedForms.map(formId => 
        fetch(`http://44.222.140.196:8000/forms/${formId}/confirm`, {
          method: 'PUT'
        })
      );

      await Promise.all(confirmPromises);

      // 3. confirmed 탭으로 이동 및 데이터 새로고침
      setActiveTab('confirmed');
      const updatedResponse = await fetch(`http://44.222.140.196:8000/dashboard?status=confirmed`);
      const data = await updatedResponse.json();
      setForms(data.forms);
      setCounts(data.counts);
      
      // 선택 초기화
      setSelectedForms([]);
      
    } catch (error) {
      console.error('Error processing forms:', error);
      alert('Failed to process forms. Please try again.');
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar>
        <SidebarItem label="Tennessee" active={true} />
        <SidebarItem label="Kentucky" />
      </Sidebar>

      <div className="flex-grow p-6">
        <h1 className="text-xl font-bold mb-6">DASHBOARD</h1>
        
        <div className="grid grid-cols-3 gap-6 mb-8 justify-center">
            <div className="bg-[#f0f9f4] p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-gray-600 uppercase text-lg font-semibold">PENDING</h3>
                <p className="text-5xl font-bold mt-2">{counts.pending}</p>
            </div>
            <div className="bg-[#f0f9f4] p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-gray-600 uppercase text-lg font-semibold">APPROVED</h3>
                <p className="text-5xl font-bold mt-2">{counts.approved}</p>
            </div>
            <div className="bg-[#f0f9f4] p-6 rounded-lg shadow-lg text-center">
                <h3 className="text-gray-600 uppercase text-lg font-semibold">CONFIRMED</h3>
                <p className="text-5xl font-bold mt-2">{counts.confirmed}</p>
            </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button 
            className={`px-4 py-2 ${activeTab === 'pending' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            PENDING
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'approved' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('approved')}
          >
            APPROVED
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'confirmed' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('confirmed')}
          >
            CONFIRMED
          </button>
          <button 
            className={`px-4 py-2 ${activeTab === 'past_2months' ? 'text-blue-500 border-b-2 border-blue-500' : ''}`}
            onClick={() => setActiveTab('past_2months')}
          >
            PAST DATA
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left text-blue-500">No.</th>
                <th className="p-4 text-left text-blue-500">Employee Name</th>
                <th className="p-4 text-left text-blue-500">Requester Name</th>
                <th className="p-4 text-left text-blue-500">Request Date</th>
                <th className="p-4 text-left text-blue-500">Service Week</th>
                <th className="p-4 text-left text-blue-500">Total Hours</th>
                <th className="p-4 text-left text-blue-500">
                  <div className="flex items-center gap-2">
                    <span>Select</span>
                    <input
                      type="checkbox"
                      checked={forms.length > 0 && selectedForms.length === forms.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center p-4">Loading...</td>
                </tr>
              ) : forms.length > 0 ? (
                forms.map(form => (
                  <tr key={form.No} className="border-b">
                    <td className="p-4">{form.No}</td>
                    <td className="p-4">{form['Employee Name']}</td>
                    <td className="p-4">{form['Requester Name']}</td>
                    <td className="p-4">{form['Request Date']}</td>
                    <td className="p-4">{form['Service Week']}</td>
                    <td className="p-4">{form['Total Hours']}</td>
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedForms.includes(form.No)}
                        onChange={() => handleSelectOne(form.No)}
                        className="w-4 h-4 rounded border-gray-300"
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center p-4 text-gray-500">
                    No data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="actions mt-4 flex justify-center gap-4">
          {activeTab === 'pending' && (
            <>
              <button className="cursor-pointer group relative flex gap-1.5 px-8 py-4 bg-black bg-opacity-80 text-[#f1f1f1] rounded-3xl hover:bg-opacity-70 transition font-semibold shadow-md" 
                      onClick={handleReject} 
                      disabled={selectedForms.length === 0}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="24px" width="24px">
                  <g stroke-width="0" id="SVGRepo_bgCarrier"></g>
                  <g stroke-linejoin="round" stroke-linecap="round" id="SVGRepo_tracerCarrier"></g>
                  <g id="SVGRepo_iconCarrier">
                    <g id="Interface / Delete">
                      <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#f1f1f1" d="M6 21H18M12 3V17M12 17L7 12M12 17L17 12" id="Vector"></path>
                    </g>
                  </g>
                </svg>
                Delete
                <div className="absolute opacity-0 -bottom-full rounded-md py-2 px-2 bg-black bg-opacity-70 left-1/2 -translate-x-1/2 group-hover:opacity-100 transition-opacity shadow-lg">
                  Delete
                </div>
              </button>
              <button className="cursor-pointer group relative flex gap-1.5 px-8 py-4 bg-black bg-opacity-80 text-[#f1f1f1] rounded-3xl hover:bg-opacity-70 transition font-semibold shadow-md" 
                      onClick={handleApprove} 
                      disabled={selectedForms.length === 0}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="24px" width="24px">
                  <g stroke-width="0" id="SVGRepo_bgCarrier"></g>
                  <g stroke-linejoin="round" stroke-linecap="round" id="SVGRepo_tracerCarrier"></g>
                  <g id="SVGRepo_iconCarrier">
                    <g id="Interface / Approve">
                      <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#f1f1f1" d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12" id="Vector"></path>
                    </g>
                  </g>
                </svg>
                Approve
                <div className="absolute opacity-0 -bottom-full rounded-md py-2 px-2 bg-black bg-opacity-70 left-1/2 -translate-x-1/2 group-hover:opacity-100 transition-opacity shadow-lg">
                  Approve
                </div>
              </button>
            </>
          )}
          {activeTab === 'approved' && (
            <button className="cursor-pointer group relative flex gap-1.5 px-8 py-4 bg-black bg-opacity-80 text-[#f1f1f1] rounded-3xl hover:bg-opacity-70 transition font-semibold shadow-md" 
                    onClick={handleConfirm} 
                    disabled={selectedForms.length === 0}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="24px" width="24px">
                <g stroke-width="0" id="SVGRepo_bgCarrier"></g>
                <g stroke-linejoin="round" stroke-linecap="round" id="SVGRepo_tracerCarrier"></g>
                <g id="SVGRepo_iconCarrier">
                  <g id="Interface / Download">
                    <path stroke-linejoin="round" stroke-linecap="round" stroke-width="2" stroke="#f1f1f1" d="M6 21H18M12 3V17M12 17L17 12M12 17L7 12" id="Vector"></path>
                  </g>
                </g>
              </svg>
              Download
              <div className="absolute opacity-0 -bottom-full rounded-md py-2 px-2 bg-black bg-opacity-70 left-1/2 -translate-x-1/2 group-hover:opacity-100 transition-opacity shadow-lg">
                Download
              </div>
            </button>
          )}
        </div>
      </div>

      {/* PDF 미리보기 모달 */}
      {showPreview && previewUrl && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>PDF Preview</h2>
              <button onClick={() => setShowPreview(false)}>Close</button>
            </div>
            <div className="modal-body">
              <iframe
                src={previewUrl}
                width="100%"
                height="500px"
                title="PDF Preview"
              />
            </div>
            <div className="modal-footer">
              <button onClick={handleDownloadMergedPDF}>
                Download Merged PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF 미리보기 패널 */}
      {pdfUrl && (
        <div className="w-1/2 h-screen border-l">
          <div className="h-full">
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;