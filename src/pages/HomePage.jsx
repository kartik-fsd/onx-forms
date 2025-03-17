import { useState, useEffect } from "preact/hooks";
import { DraftDAO, FormDAO } from "../db";
import {
  isAppInstalled,
  requestNotificationPermission,
} from "../utils/serviceWorker";

const HomePage = () => {
  const [projects, setProjects] = useState([]);
  const [recentDrafts, setRecentDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [installPrompt, setInstallPrompt] = useState(null);

  // Fetch projects and recent drafts
  useEffect(() => {
    const fetchData = async () => {
      try {
        // In a real implementation, this would fetch projects from the API
        // For now, we'll use mock data
        const mockProjects = [
          { id: "project1", name: "Store Survey" },
          { id: "project2", name: "Customer Feedback" },
          { id: "project3", name: "Product Inventory" },
        ];

        setProjects(mockProjects);

        // Get all draft forms
        const allDrafts = [];
        for (const project of mockProjects) {
          const forms = await FormDAO.getFormsByProject(project.id);

          for (const form of forms) {
            const drafts = await DraftDAO.getDraftsByForm(form.id);

            for (const draft of drafts) {
              allDrafts.push({
                ...draft,
                formTitle: form.title,
                projectName: project.name,
                projectId: project.id,
              });
            }
          }
        }

        // Sort by last updated and take the most recent 5
        const sortedDrafts = allDrafts
          .sort((a, b) => {
            return new Date(b.lastUpdated) - new Date(a.lastUpdated);
          })
          .slice(0, 5);

        setRecentDrafts(sortedDrafts);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent Chrome 76+ from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Request notification permission
    requestNotificationPermission();

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  // Install app handler
  const handleInstallClick = async () => {
    if (!installPrompt) return;

    // Show the install prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // Clear the saved prompt since it can't be used again
    setInstallPrompt(null);
  };

  // Function to format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin mb-4 h-12 w-12 border-t-2 border-b-2 border-blue-500 rounded-full mx-auto"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            FSE Lead Collection
          </h1>
          <p className="text-gray-600">
            Field Sales Executive Data Collection System
          </p>
        </header>

        {/* Install prompt */}
        {installPrompt && !isAppInstalled() && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-medium text-blue-800">Install the app</h3>
                <p className="text-sm text-blue-600 mt-1">
                  Install this app on your device for a better experience with
                  offline support.
                </p>
              </div>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
              >
                Install
              </button>
            </div>
          </div>
        )}

        {/* Projects section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Projects</h2>

          {projects.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <p className="text-gray-600">
                No projects available. Please check back later.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">
                      {project.name}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Tap to view available forms for this project.
                    </p>
                    <a
                      href={`/project/${project.id}`}
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                      View Forms
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent drafts section */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Recent Drafts
          </h2>

          {recentDrafts.length === 0 ? (
            <div className="bg-white p-6 rounded-lg shadow-md text-center">
              <p className="text-gray-600">
                No recent drafts. Start a new form to create one.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {recentDrafts.map((draft) => (
                  <li key={draft.id} className="p-4 hover:bg-gray-50">
                    <a
                      href={`/form/${draft.projectId}/${draft.formId}/draft/${draft.id}`}
                      className="block"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-md font-medium text-gray-800">
                            {draft.formTitle}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {draft.projectName}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-500">
                            Last updated
                          </span>
                          <p className="text-sm font-medium text-gray-800">
                            {formatDate(draft.lastUpdated)}
                          </p>
                        </div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
