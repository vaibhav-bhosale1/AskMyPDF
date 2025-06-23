
const ThinkingLoader = () => {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative flex items-center space-x-4">
 
        <div className="relative">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-8 h-8 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 rounded-full animate-ping opacity-20"></div>
          <div className="absolute inset-1 w-6 h-6 bg-white rounded-full opacity-30 blur-sm"></div>
        </div>



        <div className="relative">
          <div className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 text-base lg:text-lg font-semibold animate-pulse">
            Thinking
          </div>
          <div className="absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 animate-pulse" 
               style={{width: '100%', animation: 'expandContract 2s ease-in-out infinite'}}></div>
        </div>

        <div className="relative w-12 h-8 overflow-hidden">
          <div className="absolute w-1 h-1 bg-green-300 rounded-full opacity-60" 
               style={{
                 left: '10%',
                 animation: 'float 3s ease-in-out infinite',
                 animationDelay: '0s'
               }}></div>
          <div className="absolute w-1 h-1 bg-emerald-300 rounded-full opacity-60" 
               style={{
                 left: '40%',
                 animation: 'float 3s ease-in-out infinite reverse',
                 animationDelay: '1s'
               }}></div>
          <div className="absolute w-1 h-1 bg-teal-300 rounded-full opacity-60" 
               style={{
                 left: '70%',
                 animation: 'float 3s ease-in-out infinite',
                 animationDelay: '2s'
               }}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes expandContract {
          0%, 100% { transform: scaleX(0.3); opacity: 0.5; }
          50% { transform: scaleX(1); opacity: 1; }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.3; }
          25% { transform: translateY(-8px) translateX(2px); opacity: 0.8; }
          50% { transform: translateY(-4px) translateX(-2px); opacity: 0.6; }
          75% { transform: translateY(-6px) translateX(1px); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
};

export default ThinkingLoader;