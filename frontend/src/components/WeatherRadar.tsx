import React from 'react';

export const WeatherRadar = () => {
  return (
    <div className="weather-radar">
      {/* Live radar overlay implementation */}
      <iframe src="https://embed.windy.com/embed2.html" width="100%" height="450" frameBorder="0"></iframe>
    </div>
  );
};
