export const initialFormData = {
    employeeName: '',
    requestDate: null,
    requestorName: '',
    serviceWeek: {
      start: '',
      end: ''
    },
    schedule: {
      Monday: { time: '', location: '', customTime: '' },
      Tuesday: { time: '', location: '', customTime: '' },
      Wednesday: { time: '', location: '', customTime: '' },
      Thursday: { time: '', location: '', customTime: '' },
      Friday: { time: '', location: '', customTime: '' },
    },
    supervisorSignature: null,
    savedSignature: null
  };
  
  export const workingTimeOptions = [
    'Shift 1: 8:00 AM - 5:00 PM',
    'Shift 2: 7:00 PM - 1:00 AM',
    //'Shift 3: 1:00 AM - 8:00 AM',
    'Type in',
    'Off',
  ];