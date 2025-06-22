// app/admin/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '../_components/Header';
import Footer from '../_components/Footer';
// Import the NEWLY DEFINED types for LocationClean and WorkoutClean
import type { LocationClean, WorkoutClean } from '../../../types/workout'; // Adjust path if needed
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'; // Added Suspense

// For icons
import { TrashIcon, PlusCircleIcon, PencilIcon } from '@heroicons/react/24/solid'; // Requires @heroicons/react installed: npm install @heroicons/react

// Define interfaces for form states (for modals)
interface NewLocationFormState extends Omit<LocationClean, '_id'> {
  _id?: string; // Optional for new location
}

// Corrected WorkoutFormState to reflect WorkoutClean's fields
interface WorkoutFormState extends Omit<WorkoutClean, '_id' | 'locationId'> {
  _id?: string; // Optional for new workout
  locationId: string; // Mandatory when creating/editing a workout, derived from selected location
}

// Define type for grouped workouts (for display)
interface WorkoutsByLocation {
  [locationId: string]: WorkoutClean[];
}

// This is the new component that will use useSearchParams
function AdminDashboard() {
  const searchParams = useSearchParams();
  const providedPassword = searchParams.get('pw');

  const [locations, setLocations] = useState<LocationClean[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutClean[]>([]); // Flat list of all workouts

  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State for Add/Edit Location Modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocationData, setEditingLocationData] = useState<NewLocationFormState | null>(null); // For editing existing location

  // State for Add/Edit Workout Modal
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [currentWorkoutLocationId, setCurrentWorkoutLocationId] = useState<string | null>(null); // Location ID for current workout modal
  // Corrected initial state for editingWorkoutData to match WorkoutClean's structure
  const [editingWorkoutData, setEditingWorkoutData] = useState<WorkoutFormState | null>(null); // For editing existing workout

  // New location form state
  const [newLocationData, setNewLocationData] = useState<NewLocationFormState>({
    name: '',
    mapLink: '',
    address: '',
    description: '',
  });

  // Corrected newWorkoutData state to match WorkoutClean's structure
  const [newWorkoutData, setNewWorkoutData] = useState<Omit<WorkoutClean, '_id' | 'locationId'>>({
    style: '',
    day: '',
    time: '',
    q: '',
    avgAttendance: '',
  });

  const CLIENT_ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  // --- Data Fetching ---
  const refreshAllData = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const password = providedPassword;
      if (!password) {
        setMessage('Error: Admin password not found in URL.');
        setIsLoading(false);
        return;
      }

      // Fetch locations
      const locationsResponse = await fetch(`/api/locations?pw=${password}`);
      const locationsData = await locationsResponse.json();
      if (!locationsResponse.ok) {
        throw new Error(locationsData.message || `API Error fetching locations: ${locationsResponse.status}`);
      }
      if (!Array.isArray(locationsData)) {
        console.error('AdminPage: ERROR - Fetched locations data is not an array! Received:', locationsData);
        setLocations([]);
        setMessage('Error: Locations data from server was not in expected format.');
        return;
      }
      setLocations(locationsData);

      // Fetch workouts
      const workoutsResponse = await fetch(`/api/workouts?pw=${password}`);
      const workoutsData = await workoutsResponse.json();
      if (!workoutsResponse.ok) {
        throw new Error(workoutsData.message || `API Error fetching workouts: ${workoutsResponse.status}`);
      }
      if (!Array.isArray(workoutsData)) {
        console.error('AdminPage: ERROR - Fetched workouts data is not an array! Received:', workoutsData);
        setWorkouts([]);
        setMessage('Error: Workouts data from server was not in expected format.');
        return;
      }
      setWorkouts(workoutsData);

      console.log("AdminPage: All data fetched successfully.");
    } catch (error) {
      console.error('AdminPage: Error in refreshAllData:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred while refreshing data.';
      setMessage(`Error refreshing data: ${errorMessage}`);
      setLocations([]);
      setWorkouts([]);
    } finally {
      setIsLoading(false);
    }
  }, [providedPassword]); // Added providedPassword to refreshAllData dependencies

  useEffect(() => {
    if (providedPassword === undefined) { // Still waiting for Suspense to resolve searchParams
        return;
    }
    if (providedPassword && providedPassword === CLIENT_ADMIN_PASSWORD) {
      refreshAllData();
    } else if (providedPassword === null && CLIENT_ADMIN_PASSWORD) { // No pw provided, but one is set
      setMessage('Access Denied: Password required.');
    } else if (providedPassword && providedPassword !== CLIENT_ADMIN_PASSWORD) {
      setMessage('Access Denied: Invalid password in URL.');
    } else if (!CLIENT_ADMIN_PASSWORD && providedPassword) {
        // This case might mean admin password is not set in .env but user provided one.
        // Depending on desired behavior, you might allow access or deny.
        // For now, let's assume if NEXT_PUBLIC_ADMIN_PASSWORD is not set, access is restricted.
        setMessage('Access Denied: Admin password not configured on server.');
    } else if (!CLIENT_ADMIN_PASSWORD && !providedPassword) {
        // No password set, no password provided - potentially allow access or show setup message
        // For now, assume access if no password is set up.
        // console.log("AdminPage: No admin password set. Allowing access.");
        refreshAllData(); // Or, you might want to restrict this.
    }
  }, [providedPassword, CLIENT_ADMIN_PASSWORD, refreshAllData]);

  // --- Grouping Workouts by Location ---
  const workoutsGroupedByLocation = useMemo(() => {
    const grouped: WorkoutsByLocation = {};
    workouts.forEach(workout => {
      if (workout.locationId) { // Ensure workout has a locationId
        if (!grouped[workout.locationId]) {
          grouped[workout.locationId] = [];
        }
        grouped[workout.locationId].push(workout);
      }
    });

    // Sort workouts within each location by Day, then Time, then Style
    for (const locId in grouped) {
      grouped[locId].sort((a, b) => {
        const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const dayA = daysOrder.indexOf(a.day);
        const dayB = daysOrder.indexOf(b.day);
        if (dayA !== dayB) return dayA - dayB;

        if (a.time && b.time) {
          const timeComparison = a.time.localeCompare(b.time);
          if (timeComparison !== 0) return timeComparison;
        }

        if (a.style && b.style) {
          return a.style.localeCompare(b.style);
        }
        return 0;
      });
    }

    return grouped;
  }, [workouts]);

  // --- Location Management Handlers ---
  const handleOpenAddLocationModal = () => {
    setEditingLocationData(null); // Clear any previous edit data
    setNewLocationData({ name: '', mapLink: '', address: '', description: '' }); // Reset form
    setShowLocationModal(true);
  };

  const handleOpenEditLocationModal = (location: LocationClean) => {
    setEditingLocationData({ ...location }); // Populate form with existing data
    setShowLocationModal(true);
  };

  const handleCloseLocationModal = () => {
    setShowLocationModal(false);
    setEditingLocationData(null);
    setNewLocationData({ name: '', mapLink: '', address: '', description: '' }); // Reset form
    setMessage(null); // Clear any modal-specific messages
  };

  const handleLocationInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingLocationData) {
      setEditingLocationData(prev => ({ ...prev!, [name]: value }));
    } else {
      setNewLocationData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddEditLocation = async () => {
    setIsLoading(true);
    setMessage(null);

    const dataToSend = editingLocationData || newLocationData;
    // Method remains POST for both create/update as per previous API design
    const url = `/api/locations?pw=${providedPassword}`;

    // Basic validation
    if (!dataToSend.name.trim() || !dataToSend.mapLink.trim()) {
      setMessage('Error: Location Name and Map Link are required.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `API Error: ${response.status}`);
      }

      setMessage(result.message || (editingLocationData ? 'Location updated successfully!' : 'Location added successfully!'));
      handleCloseLocationModal();
      refreshAllData(); // Refresh all data to include new/updated location
    } catch (error) {
      console.error('Failed to add/edit location:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLocation = async (locationId: string, locationName: string) => {
    if (!confirm(`Are you sure you want to delete "${locationName}" and all its associated workouts? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/locations?pw=${providedPassword}&id=${locationId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `API Error: ${response.status}`);
      }
      setMessage(result.message || 'Location and its workouts deleted successfully!');
      refreshAllData();
    } catch (error) {
      console.error('Failed to delete location:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Workout Management Handlers (within a location card) ---
  const handleOpenAddWorkoutModal = (locationId: string) => {
    setCurrentWorkoutLocationId(locationId);
    setEditingWorkoutData(null); // Clear any previous edit data
    // Reset newWorkoutData to match WorkoutClean's structure
    setNewWorkoutData({ style: '', day: '', time: '', q: '', avgAttendance: '' });
    setShowWorkoutModal(true);
  };

  const handleOpenEditWorkoutModal = (workout: WorkoutClean) => {
    setCurrentWorkoutLocationId(workout.locationId);
    // Populate form with existing data, only workout-specific fields
    setEditingWorkoutData({
      _id: workout._id,
      style: workout.style ?? '',
      day: workout.day ?? '',
      time: workout.time ?? '',
      q: workout.q ?? '',
      avgAttendance: workout.avgAttendance ?? '',
      locationId: workout.locationId // Keep locationId for the API call
    });
    setShowWorkoutModal(true);
  };

  const handleCloseWorkoutModal = () => {
    setShowWorkoutModal(false);
    setCurrentWorkoutLocationId(null);
    setEditingWorkoutData(null);
    // Reset newWorkoutData to match WorkoutClean's structure
    setNewWorkoutData({ style: '', day: '', time: '', q: '', avgAttendance: '' });
    setMessage(null); // Clear any modal-specific messages
  };

  const handleWorkoutInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    // Determine which state to update (editing or new)
    if (editingWorkoutData) {
      setEditingWorkoutData(prev => ({ ...prev!, [name]: value }));
    } else {
      setNewWorkoutData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleAddEditWorkout = async () => {
    setIsLoading(true);
    setMessage(null);

    let dataToSend: WorkoutClean;

    // Determine if adding or editing
    if (editingWorkoutData) {
      // Ensure editing data includes the original locationId
      dataToSend = { ...editingWorkoutData, locationId: currentWorkoutLocationId! } as WorkoutClean;
    } else {
      // For new workouts, ensure locationId is set
      if (!currentWorkoutLocationId) {
        setMessage('Error: Workout must be associated with a location.');
        setIsLoading(false);
        return;
      }
      dataToSend = { ...newWorkoutData, locationId: currentWorkoutLocationId } as WorkoutClean;
    }

    const url = `/api/workouts?pw=${providedPassword}`;

    // Basic validation for workout fields
    if (!dataToSend.day.trim() || !dataToSend.time.trim()) {
      setMessage('Error: Day and Time are required for workouts.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `API Error: ${response.status}`);
      }

      setMessage(result.message || (editingWorkoutData ? 'Workout updated successfully!' : 'Workout added successfully!'));
      handleCloseWorkoutModal();
      refreshAllData(); // Refresh all data to include new/updated workout
    } catch (error) {
      console.error('Failed to add/edit workout:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/workouts?pw=${providedPassword}&id=${workoutId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `API Error: ${response.status}`);
      }
      setMessage(result.message || 'Workout deleted successfully!');
      refreshAllData();
    } catch (error) {
      console.error('Failed to delete workout:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessage(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

   // Handle cases where searchParams might not be immediately available
  if (providedPassword === undefined && CLIENT_ADMIN_PASSWORD) { // Check if password is required but not yet available
    return (
        <main className="container mx-auto px-4 py-8 text-center">
            <p>Loading admin interface...</p>
        </main>
    );
  }


  // --- Access Denied / Main Render ---
  // Logic for CLIENT_ADMIN_PASSWORD being undefined (not set)
  const isPasswordProtected = !!CLIENT_ADMIN_PASSWORD;
  const canAccess = isPasswordProtected ? providedPassword === CLIENT_ADMIN_PASSWORD : true;


  if (!canAccess) {
    return (
      <>
        {/* Header is outside AdminDashboard, so it will render without Suspense issues */}
        <main className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-4">
            {message || (CLIENT_ADMIN_PASSWORD ? "You have not provided the correct password or it's missing." : "Admin access is currently not password protected, but an issue occurred.")}
          </p>
          <Link href="/" className="mt-6 inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">
            Go to Homepage
          </Link>
        </main>
        {/* Footer is outside AdminDashboard */}
      </>
    );
  }

  // Actual dashboard content if access is granted
  return (
    <>
      {/* Header and Footer are rendered by the AdminPage parent component */}
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Admin Dashboard
        </h1>

        {isLoading && <p className="text-center text-blue-500">Loading/Saving data...</p>}
        {message && (
          <p className={`text-center p-3 mb-6 rounded-md ${message.startsWith('Error:') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </p>
        )}

        {/* Add New Location Button */}
        <div className="mb-8 text-center">
          <button
            onClick={handleOpenAddLocationModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center justify-center mx-auto transition duration-300 ease-in-out"
          >
            <PlusCircleIcon className="h-6 w-6 mr-2" /> Add New Location
          </button>
        </div>

        {/* Locations Grid */}
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Locations & Workouts</h2>
        {locations.length === 0 && !isLoading ? (
          <p className="text-center text-gray-600">No locations found. Click {`"Add New Location"`} to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map(location => (
              <div key={location._id} className="bg-white rounded-lg shadow-xl p-6 border border-gray-200 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900">{location.name}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleOpenEditLocationModal(location)}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition duration-200"
                      title="Edit Location"
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLocation(location._id, location.name)}
                      className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition duration-200"
                      title="Delete Location"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-700 text-sm mb-2">
                  <span className="font-semibold">Map:</span>{' '}
                  <a href={location.mapLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">
                    {location.mapLink}
                  </a>
                </p>
                {location.address && <p className="text-gray-700 text-sm mb-2"><span className="font-semibold">Address:</span> {location.address}</p>}
                {location.description && <p className="text-gray-700 text-sm mb-4"><span className="font-semibold">Description:</span> {location.description}</p>}

                <div className="mt-auto pt-4 border-t border-gray-200">
                  <h4 className="text-lg font-semibold mb-3 text-gray-800">Workouts:</h4>
                  {workoutsGroupedByLocation[location._id] && workoutsGroupedByLocation[location._id].length > 0 ? (
                    <div className="space-y-3">
                      {workoutsGroupedByLocation[location._id].map(workout => (
                        <div key={workout._id} className="bg-gray-50 p-3 rounded-md shadow-sm border border-gray-200 text-sm flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-gray-900">{workout.day} at {workout.time}</p>
                            <p className="text-gray-700">Style: {workout.style || 'N/A'}</p>
                            <p className="text-gray-700">Q: {workout.q || 'N/A'}</p>
                            <p className="text-gray-700">Avg. Att: {workout.avgAttendance || 'N/A'}</p>
                          </div>
                          <div className="flex space-x-2 flex-shrink-0">
                            <button
                              onClick={() => handleOpenEditWorkoutModal(workout)}
                              className="text-green-600 hover:text-green-800 p-1 rounded-full hover:bg-green-50 transition duration-200"
                              title="Edit Workout"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteWorkout(workout._id)}
                              className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition duration-200"
                              title="Delete Workout"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No workouts for this location yet.</p>
                  )}
                  <button
                    onClick={() => handleOpenAddWorkoutModal(location._id)}
                    className="mt-4 bg-purple-600 hover:bg-purple-700 text-white text-sm py-2 px-4 rounded-md flex items-center justify-center transition duration-300 ease-in-out w-full"
                  >
                    <PlusCircleIcon className="h-5 w-5 mr-1" /> Add Workout
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* --- Modals --- */}
      {/* Location Add/Edit Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {editingLocationData ? 'Edit Location' : 'Add New Location'}
            </h2>
            <form onSubmit={(e) => { e.preventDefault(); handleAddEditLocation(); }}>
              <div className="mb-4">
                <label htmlFor="location-name" className="block text-gray-700 text-sm font-bold mb-2">
                  Location Name (AO)<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location-name"
                  name="name"
                  value={editingLocationData?.name ?? newLocationData.name}
                  onChange={handleLocationInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., The Pit"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="location-mapLink" className="block text-gray-700 text-sm font-bold mb-2">
                  Map Link<span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  id="location-mapLink"
                  name="mapLink"
                  value={editingLocationData?.mapLink ?? newLocationData.mapLink}
                  onChange={handleLocationInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., https://goo.gl/maps/..."
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="location-address" className="block text-gray-700 text-sm font-bold mb-2">
                  Address
                </label>
                <input
                  type="text"
                  id="location-address"
                  name="address"
                  value={editingLocationData?.address ?? newLocationData.address}
                  onChange={handleLocationInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., 123 Main St, City, State"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="location-description" className="block text-gray-700 text-sm font-bold mb-2">
                  Description
                </label>
                <textarea
                  id="location-description"
                  name="description"
                  value={editingLocationData?.description ?? newLocationData.description}
                  onChange={handleLocationInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline h-24 resize-none"
                  placeholder="e.g., Outdoor park with pull-up bars"
                />
              </div>
              {isLoading && <p className="text-blue-500 text-center mb-4">Saving...</p>}
              {message && (
                <p className={`text-center p-2 mb-4 rounded-md ${message.startsWith('Error:') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {message}
                </p>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCloseLocationModal}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                >
                  {editingLocationData ? 'Save Changes' : 'Add Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workout Add/Edit Modal */}
      {showWorkoutModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              {editingWorkoutData ? 'Edit Workout' : 'Add New Workout'}
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              For Location: <span className="font-semibold">{locations.find(loc => loc._id === currentWorkoutLocationId)?.name || 'N/A'}</span>
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleAddEditWorkout(); }}>
              <div className="mb-4">
                <label htmlFor="workout-style" className="block text-gray-700 text-sm font-bold mb-2">
                  Style
                </label>
                <input
                  type="text"
                  id="workout-style"
                  name="style"
                  value={editingWorkoutData?.style ?? newWorkoutData.style}
                  onChange={handleWorkoutInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., Bootcamp"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="workout-day" className="block text-gray-700 text-sm font-bold mb-2">
                  Day<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="workout-day"
                  name="day"
                  value={editingWorkoutData?.day ?? newWorkoutData.day}
                  onChange={handleWorkoutInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., Monday"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="workout-time" className="block text-gray-700 text-sm font-bold mb-2">
                  Time<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="workout-time"
                  name="time"
                  value={editingWorkoutData?.time ?? newWorkoutData.time}
                  onChange={handleWorkoutInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., 05:30"
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="workout-q" className="block text-gray-700 text-sm font-bold mb-2">
                  Q (Leader)
                </label>
                <input
                  type="text"
                  id="workout-q"
                  name="q"
                  value={editingWorkoutData?.q ?? newWorkoutData.q}
                  onChange={handleWorkoutInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., Dredd"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="workout-avgAttendance" className="block text-gray-700 text-sm font-bold mb-2">
                  Avg. Attendance
                </label>
                <input
                  type="text"
                  id="workout-avgAttendance"
                  name="avgAttendance"
                  value={editingWorkoutData?.avgAttendance ?? newWorkoutData.avgAttendance}
                  onChange={handleWorkoutInputChange}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-900 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="e.g., 10"
                />
              </div>
              {isLoading && <p className="text-blue-500 text-center mb-4">Saving...</p>}
              {message && (
                <p className={`text-center p-2 mb-4 rounded-md ${message.startsWith('Error:') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {message}
                </p>
              )}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleCloseWorkoutModal}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                >
                  {editingWorkoutData ? 'Save Changes' : 'Add Workout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Footer is rendered by the AdminPage parent component */}
    </>
  );
}

// This is the main page component, now wrapping AdminDashboard in Suspense
export default function AdminPage() {
  return (
    <>
      <Header href="/admin" />
      <Suspense fallback={<div className="container mx-auto px-4 py-8 text-center">Loading admin controls...</div>}>
        <AdminDashboard />
      </Suspense>
      <Footer />
    </>
  );
}
