interface StatsCardProps {
  icon: string;
  title: string;
  count: string;
  variant?: 'pending' | 'approved' | 'past';
}

export const StatsCard = ({ icon, title, count, variant = 'pending' }: StatsCardProps) => {
  const getColor = () => {
    switch (variant) {
      case 'pending':
        return '#560bad';
      case 'approved':
        return '#00eb4d';
      case 'past':
        return '#eb0000';
      default:
        return '#560bad';
    }
  };

  const getHoverColor = () => {
    switch (variant) {
      case 'pending':
        return '#9b87f5'; // Primary Purple for hover
      case 'approved':
        return '#7E69AB'; // Secondary Purple for hover
      case 'past':
        return '#1EA5E9'; // Bright Blue for hover
      default:
        return '#9b87f5';
    }
  };

  return (
    <button
      className="relative inline-block overflow-hidden font-medium rounded-md transition-colors duration-500 hover:text-white active:before:bg-[#3a0ca3] group"
      style={{
        '--color': getColor(),
        '--hover-color': getHoverColor(),
        width: '100%',
        height: 'auto',
        margin: 0,
        padding: '16px 24px',
        border: `2px solid ${getColor()}`,
        color: getColor(),
      } as React.CSSProperties}
    >
      <span className="relative z-10 flex items-center gap-4">
        <div className="p-3 rounded-full bg-white/10">
          <img src={icon} alt="" className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-1 items-start">
          <h3 className="text-sm font-medium group-hover:text-white transition-colors">{title}</h3>
          <p className="text-2xl font-bold group-hover:text-white transition-colors">{count}</p>
        </div>
      </span>
      <div 
        className="absolute z-0 w-[200px] h-[150px] rounded-full transition-all duration-700 before:content-['']"
        style={{
          background: 'var(--hover-color)',
          top: '100%',
          left: '100%',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </button>
  );
};