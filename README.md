# Lab 2: Oh, the Places You've Been!

**Course:** CS 465 – Fall 2025  
**Author:** Rikuto Ota  

This project is a simple interactive web application that lets users mark and describe meaningful locations on a world map.  
It’s built with **React**, **Vite**, and **Leaflet**, using **OpenStreetMap** as the base map.  

The main goal is to give users a fun and visual way to record places they’ve lived, visited, or want to go someday — all within a browser-based interactive map.

---

## Main Features

- **Interactive Map:** Displays a responsive world map using **Leaflet** and **OpenStreetMap**.  
- **Add Locations:** Click anywhere on the map to drop a marker and describe that location.  
- **Custom Notes:** Add details like when you lived there, memories, or favorite restaurants.  
- **Location List:** View, edit, or delete places you’ve added in a side list.  
- **Data Saving:** Your places are stored in **localStorage**, so they stay even after refreshing the page.  
- **Control Buttons:**
  - Done:** Stop adding new places and view your map.  
  - Reset:** Clear everything and start fresh.  
  - Export JSON:** Save your list of places as a JSON file.  
  - Import JSON:** Load a saved JSON file to restore your map.  
- **Auto Location Details:** Uses the **Nominatim API** to automatically find the city and country of each location.
