// src/app/workouts/page.tsx

import Link from 'next/link';

import Header from '../_components/Header';
import Footer from '../_components/Footer';
import Hero from '../_components/Hero';
import Button from '../_components/Button';
// Import WorkoutCard directly as default, and sortWorkouts as a named export
import WorkoutCard, { sortWorkouts } from '../_components/WorkoutCard';

/** replace with a regional image */
import f3HeroImg from '../../../public/f3-darkhorse-2023-11-04.jpg';

import { fetchWorkoutsData } from '../../utils/fetchWorkoutsData';
import { fetchLocaleData } from '@/utils/fetchLocaleData';
// Ensure WorkoutClean and LocationClean are imported
import type { WorkoutClean, LocationClean } from '../../../types/workout';
// IMPORT THE NEW CONVERSION UTILITY
import { convertWorkoutsToCardProps } from '../../utils/convertWorkouts';
import type { WorkoutCardProps } from '../_components/WorkoutCard'; // Import WorkoutCardProps for grouping

// Import the GET function from the API route
import { GET as fetchLocationsAPI } from '../api/locations/route';
import { NextRequest } from 'next/server';


// Define a type for the grouped workouts for display on this page
interface GroupedWorkoutsByLocation {
  [locationId: string]: WorkoutCardProps[];
}


export default async function Page() {
  // 1. Fetch raw data for workouts. This returns WorkoutClean[].
  const rawWorkouts: WorkoutClean[] = await fetchWorkoutsData();

  // 2. Fetch locations data by directly calling the API route's GET function.
  let rawLocations: LocationClean[] = [];
  try {
    // We need to mock a NextRequest object if the API handler expects it.
    // For a simple GET without searchParams or specific headers, an empty object might suffice,
    // or a more complete mock if needed. The `GET` function for locations doesn't seem to use `request` param.
    const mockRequest = {} as NextRequest; // Adjust if GET uses request details
    const locationsResponse = await fetchLocationsAPI(mockRequest);

    if (!locationsResponse.ok) {
      console.error('Workouts Page: Failed to fetch locations directly:', locationsResponse.status, await locationsResponse.text());
      rawLocations = []; // Fallback to an empty array
    } else {
      const locationsData = await locationsResponse.json();
      if (!Array.isArray(locationsData)) {
        console.error('Workouts Page: Fetched locations data is not an array! Received:', locationsData);
        rawLocations = [];
      } else {
        rawLocations = locationsData;
      }
    }
    // --- DEBUGGING LOG ---
    console.log('Workouts Page: Fetched Raw Locations:', rawLocations);
    // --- END DEBUGGING LOG ---
  } catch (error) {
    console.error('Workouts Page: Error fetching locations directly:', error);
    rawLocations = [];
  }


  // 3. Convert raw workout data to WorkoutCardProps, combining with location data.
  const workoutsForDisplay = convertWorkoutsToCardProps(rawWorkouts, rawLocations);

  // --- DEBUGGING LOG ---
  console.log('Workouts Page: Workouts for Display (after conversion):', workoutsForDisplay);
  // --- END DEBUGGING LOG ---

  // 4. Group workouts by location for structured display
  const groupedWorkouts: GroupedWorkoutsByLocation = {};
  workoutsForDisplay.forEach(workoutCard => {
    // Find the original raw workout to get its locationId
    // It's important that workoutCard._id matches a raw workout's _id to find its locationId
    const originalRawWorkout = rawWorkouts.find(raw => raw._id === workoutCard._id);
    if (originalRawWorkout && originalRawWorkout.locationId) {
      if (!groupedWorkouts[originalRawWorkout.locationId]) {
        groupedWorkouts[originalRawWorkout.locationId] = [];
      }
      groupedWorkouts[originalRawWorkout.locationId].push(workoutCard);
    }
  });

  // Sort workouts within each group (by Day, then Time, then Style)
  for (const locationId in groupedWorkouts) {
    sortWorkouts(groupedWorkouts[locationId]);
  }

  // Sort locations by name (AO name) for consistent display order
  const sortedLocations = [...rawLocations].sort((a, b) => a.name.localeCompare(b.name));


  const locales = await fetchLocaleData();
  const href = '/workouts';
  const mapDetails = {
    lat: locales.region_map_lat,
    lon: locales.region_map_lon,
    zoom: locales.region_map_zoom,
  };
  const mapUrl = `https://map.f3nation.com/?lat=${mapDetails.lat}&lon=${mapDetails.lon}&zoom=${mapDetails.zoom}`;

  return (
    <>
      <Header href={href} />
      <main>
        <Hero
          title="WORKOUTS"
          subtitle="FREE BEATDOWNS 6X/WEEK"
          imgUrl={f3HeroImg.src}
        />
        <section className={`bg-iron leading-tight py-16 px-4`}>
          <h2>AREAS OF OPERATION</h2>
          <p className="text-cmu pt-5">
            F3 workouts are held in any weather conditions, free of charge and
            open to men of all ages.
          </p>
          <p className="text-cmu pt-5 pb-10">
            Find a workout location [AO] below.
          </p>
          <iframe
            src={mapUrl}
            className="w-full pb-10"
            style={{ height: 500 }}
            title="F3 Workouts Map"
            loading="lazy"
          />
          <Button href={mapUrl} text="VIEW FULL SCREEN" target="_blank" />
        </section>
        <section className={`bg-gloom leading-tight py-16 px-4`}>
          <h2 className="py-5">JOIN US</h2>
          <div className="space-y-8"> {/* Added space between location cards */}
            {sortedLocations.length === 0 && rawWorkouts.length === 0 ? (
              <p className="text-center text-gray-400">No workouts or locations available at this time.</p>
            ) : (
              sortedLocations.map((location) => {
                const workoutsAtThisLocation = groupedWorkouts[location._id] || [];

                // Always return the location div, even if no workouts are scheduled for it.
                // This ensures all locations are displayed.
                return (
                  <div key={location._id} className="bg-white rounded-lg shadow-xl p-6 border border-gray-200 text-gray-900">
                    <h3 className="text-2xl font-bold mb-3">{location.name}</h3>
                    {location.address && <p className="text-gray-700 mb-2"><span className="font-semibold">Address:</span> {location.address}</p>}
                    <p className="text-gray-700 text-sm mb-2">
                      <span className="font-semibold">Map:</span>{' '}
                      <a href={location.mapLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                        {location.mapLink}
                      </a>
                    </p>
                    {location.description && <p className="text-gray-700 mb-4"><span className="font-semibold">Description:</span> {location.description}</p>}

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h4 className="text-xl font-semibold mb-3">Workout Schedule:</h4>
                      <ul className="space-y-4">
                        {workoutsAtThisLocation.length > 0 ? ( // Only map if there are workouts
                          workoutsAtThisLocation.map((workout) => (
                            <li key={workout._id}>
                              <WorkoutCard
                                _id={workout._id}
                                ao={workout.ao}
                                q={workout.q}
                                avgAttendance={workout.avgAttendance}
                                style={workout.style}
                                locationText={workout.locationText}
                                locationHref={workout.locationHref}
                                day={workout.day}
                                time={workout.time}
                              />
                            </li>
                          ))
                        ) : (
                          <p className="text-gray-500 italic">No workouts scheduled for this location yet.</p>
                        )}
                      </ul>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
