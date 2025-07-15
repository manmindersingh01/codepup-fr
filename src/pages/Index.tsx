import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  useUser,
  UserButton,
} from "@clerk/clerk-react";

import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import {
  ExternalLink,
  Calendar,
  Code2,
  Trash2,
  MessageSquare,
  Clock,
  AlertCircle,
  Database,
} from "lucide-react";
import SupabaseConfigForm from "./form"; // Import the form component

// --- Types ---
interface Project {
  id: number;
  name: string;
  description?: string;
  deploymentUrl?: string;
  createdAt: string;
  updatedAt?: string;
  projectType?: string;
  status?: string;
  messageCount?: number;
}

interface DbUser {
  id: number;
  clerkId: string;
  email: string;
  name: string;
  phoneNumber: string | null;
  profileImage?: string;
}

interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseToken: string;
  databaseUrl: string;
}

// --- Constants ---
const BASE_URL = import.meta.env.VITE_BASE_URL;

// --- Memoized Components ---
const ProjectCard = React.memo(
  ({
    project,
    onProjectClick,
    onDeleteProject,
    onContinueChat,
  }: {
    project: Project;
    onProjectClick: (project: Project) => void;
    onDeleteProject: (
      projectId: number,
      e: React.MouseEvent<HTMLButtonElement>
    ) => void;
    onContinueChat: (
      project: Project,
      e: React.MouseEvent<HTMLButtonElement>
    ) => void;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-700/50 rounded-xl p-4 cursor-pointer group relative overflow-hidden"
      onClick={() => onProjectClick(project)}
    >
      {/* Thumbnail */}
      <div className="w-full h-32 bg-neutral-800 rounded-lg mb-3 overflow-hidden relative">
        {project.deploymentUrl ? (
          <iframe
            src={project.deploymentUrl}
            className="w-full h-full scale-50 origin-top-left transform pointer-events-none"
            title={`${project.name} preview`}
            style={{ width: "200%", height: "200%" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Code2 className="w-8 h-8 text-neutral-600" />
          </div>
        )}

        {/* Status Badge */}
        {project.status && (
          <div className="absolute top-2 left-2">
            <span
              className={`px-2 py-1 text-xs rounded-full font-medium ${
                project.status === "ready"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : project.status === "building"
                  ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                  : project.status === "error"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-neutral-500/20 text-neutral-400 border border-neutral-500/30"
              }`}
            >
              {project.status}
            </span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <span className="text-white text-sm font-medium">Open Project</span>
        </div>
      </div>

      {/* Project Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="text-white font-medium text-sm truncate flex-1">
            {project.name}
          </h3>
          <button
            onClick={(e) => onDeleteProject(project.id, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-500/20 rounded"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
          </button>
        </div>

        {project.description && (
          <p className="text-neutral-400 text-xs line-clamp-2">
            {project.description}
          </p>
        )}

        {/* Message Count */}
        {project.messageCount && project.messageCount > 0 && (
          <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <MessageSquare className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-blue-400">
              {project.messageCount} messages
            </span>
            <button
              onClick={(e) => onContinueChat(project, e)}
              className="text-xs text-blue-400 hover:text-blue-300 underline ml-auto"
            >
              Continue Chat
            </button>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="flex items-center gap-3">
            {project.updatedAt &&
              new Date(project.updatedAt).getTime() !==
                new Date(project.createdAt).getTime() && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              )}

            {project.deploymentUrl && (
              <div className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>Live</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
);

ProjectCard.displayName = "ProjectCard";

// --- Main Component ---
const Index = () => {
  const [prompt, setPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);

  // Supabase configuration state
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig | null>(
    null
  );
  const [isConfigValid, setIsConfigValid] = useState(false);

  const navigate = useNavigate();
  const { user: clerkUser, isLoaded } = useUser();

  // Load Supabase config from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("supabaseConfig");
    if (stored) {
      try {
        const config = JSON.parse(stored);
        setSupabaseConfig(config);
        setIsConfigValid(true);
      } catch (error) {
        console.warn("Failed to load stored Supabase config");
      }
    }
  }, []);

  // Handle Supabase config submission
  const handleSupabaseConfigSubmit = useCallback((config: SupabaseConfig) => {
    setSupabaseConfig(config);
    setIsConfigValid(true);
    localStorage.setItem("supabaseConfig", JSON.stringify(config));
    console.log("Supabase configuration saved:", {
      url: config.supabaseUrl,
      hasAnonKey: !!config.supabaseAnonKey,
      hasToken: !!config.supabaseToken,
      hasDbUrl: !!config.databaseUrl,
    });
  }, []);

  // Load user from localStorage on component mount
  useEffect(() => {
    const loadUserFromStorage = () => {
      const storedUser = localStorage.getItem('dbUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setDbUser(parsedUser);
          console.log('✅ User loaded from localStorage:', parsedUser);
        } catch (error) {
          console.warn('Failed to parse stored user');
          localStorage.removeItem('dbUser');
        }
      }
    };

    loadUserFromStorage();
  }, []);

  // Clear localStorage on sign out
  useEffect(() => {
    if (isLoaded && !clerkUser) {
      // User signed out, clear localStorage
      localStorage.removeItem('dbUser');
      setDbUser(null);
      setProjects([]);
      console.log('🔄 User signed out, localStorage cleared');
    }
  }, [isLoaded, clerkUser]);

  // User sync helper function with localStorage
  const syncUserWithBackend = async (clerkUser: any): Promise<DbUser | null> => {
    try {
      // First check if user is already in localStorage
      const storedUser = localStorage.getItem('dbUser');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser.clerkId === clerkUser.id) {
            console.log('✅ Using cached user from localStorage:', parsedUser);
            return parsedUser;
          }
        } catch (error) {
          console.warn('Failed to parse stored user, will sync with backend');
        }
      }

      const userData = {
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "User",
        phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        profileImage: clerkUser.imageUrl || null,
      };

      console.log('🔍 Syncing user with backend:', userData);

      // Create/update user in database
      const userResponse = await axios.post<DbUser>(
        `${BASE_URL}/api/users`,
        userData
      );

      console.log('✅ User synced successfully:', userResponse.data);
      
      // Save user to localStorage
      localStorage.setItem('dbUser', JSON.stringify(userResponse.data));
      console.log('💾 User saved to localStorage');
      
      return userResponse.data;

    } catch (error) {
      console.error('❌ Failed to sync user with backend:', error);
      
      // Fallback: create a temporary user object
      console.log('⚠️ Using fallback user data');
      const fallbackUser = {
        id: 1, // Fallback ID
        clerkId: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "User",
        phoneNumber: clerkUser.phoneNumbers[0]?.phoneNumber || null,
        profileImage: clerkUser.imageUrl || null,
      };
      
      // Save fallback user to localStorage
      localStorage.setItem('dbUser', JSON.stringify(fallbackUser));
      
      return fallbackUser;
    }
  };

  // Memoized handlers
  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
    },
    []
  );

  const handleProjectClick = useCallback(
    (project: Project) => {
      navigate("/chatPage", {
        state: {
          projectId: project.id,
          existingProject: true,
          clerkId: dbUser?.clerkId,
          userId: dbUser?.id,
          supabaseConfig: supabaseConfig,
        },
      });
    },
    [navigate, dbUser]
  );

  const handleContinueChat = useCallback(
    (project: Project, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      navigate("/chatPage", {
        state: {
          projectId: project.id,
          existingProject: true,
          clerkId: dbUser?.clerkId,
          userId: dbUser?.id,
          supabaseConfig: supabaseConfig,
        },
      });
    },
    [navigate, dbUser]
  );

  const handleDeleteProject = useCallback(
    async (projectId: number, e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (!window.confirm("Are you sure you want to delete this project? This will also delete all associated messages.")) {
        return;
      }

      try {
        await axios.delete(`${BASE_URL}/api/projects/${projectId}`);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (error) {
        console.error("Error deleting project:", error);
      }
    },
    []
  );

  // Updated handleSubmit function
  const handleSubmit = useCallback(async () => {
    if (!dbUser || !prompt.trim()) {
      console.error("User not authenticated or prompt is empty");
      return;
    }

    // Check if Supabase config is required and valid
    if (!supabaseConfig || !isConfigValid) {
      setShowSupabaseConfig(true);
      return;
    }

    setIsLoading(true);

    try {
      // Create project in database with Clerk ID
      const projectData = {
        userId: dbUser.id,
        clerkId: dbUser.clerkId, // Include Clerk ID
        name: `Project ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        )}`,
        description:
          prompt.length > 100 ? prompt.substring(0, 100) + "..." : prompt,
        projectType: "frontend",
        status: "pending",
      };

      let newProject;
      try {
        const projectResponse = await axios.post<Project>(
          `${BASE_URL}/api/projects`,
          projectData
        );
        newProject = projectResponse.data;
      } catch (projectError) {
        console.warn(
          "Could not create project in database, proceeding without project ID"
        );
        navigate("/chatPage", {
          state: {
            prompt,
            existingProject: false,
            clerkId: dbUser.clerkId, // Pass Clerk ID
            userId: dbUser.id,
            supabaseConfig: supabaseConfig,
          },
        });
        return;
      }

      // Navigate to chat page with prompt, project ID, and user data
      navigate("/chatPage", {
        state: {
          prompt,
          projectId: newProject.id,
          existingProject: false,
          clerkId: dbUser.clerkId, // Pass Clerk ID
          userId: dbUser.id,
          supabaseConfig: supabaseConfig,
        },
      });
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setIsLoading(false);
    }
  }, [dbUser, prompt, navigate, supabaseConfig, isConfigValid]);

  // Sync user with database and fetch projects
  useEffect(() => {
    const syncUserAndFetchProjects = async () => {
      if (!isLoaded || !clerkUser) return;

      try {
        // Sync user with backend (will use localStorage cache if available)
        const backendUser = await syncUserWithBackend(clerkUser);
        
        if (!backendUser) {
          console.error('❌ Failed to sync user with backend');
          return;
        }

        // Update state if user data changed
        if (!dbUser || dbUser.id !== backendUser.id) {
          setDbUser(backendUser);
          console.log('✅ Database user updated:', backendUser);
        }

        // Fetch user's projects using the correct user ID
        setLoadingProjects(true);
        try {
          const projectsResponse = await axios.get<Project[]>(
            `${BASE_URL}/api/projects/user/${backendUser.id}`
          );

          const fetchedProjects = projectsResponse.data;
          setProjects(fetchedProjects);
          console.log(`✅ Fetched ${fetchedProjects.length} projects for user ${backendUser.id}`);

        } catch (projectError) {
          console.warn("Could not fetch projects:", projectError);
          setProjects([]);
        }
      } catch (error) {
        console.error("Error syncing user or fetching projects:", error);
      } finally {
        setLoadingProjects(false);
      }
    };

    syncUserAndFetchProjects();
  }, [clerkUser, isLoaded]); // Removed dbUser from dependencies to avoid loop

  // Memoized project cards
  const memoizedProjectCards = useMemo(() => {
    // Sort projects by message count and last update
    const sortedProjects = [...projects].sort((a, b) => {
      const aMessages = a.messageCount || 0;
      const bMessages = b.messageCount || 0;

      if (aMessages !== bMessages) {
        return bMessages - aMessages; // More messages first
      }

      // Then by update time
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      if (aTime !== bTime) {
        return bTime - aTime; // More recent first
      }

      // Finally by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sortedProjects.map((project, index) => (
      <motion.div
        key={project.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        <ProjectCard
          project={project}
          onProjectClick={handleProjectClick}
          onDeleteProject={handleDeleteProject}
          onContinueChat={handleContinueChat}
        />
      </motion.div>
    ));
  }, [
    projects,
    handleProjectClick,
    handleDeleteProject,
    handleContinueChat,
  ]);

  // Memoized project stats
  const projectStats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "ready").length;
    const projectsWithChats = projects.filter((p) => (p.messageCount || 0) > 0).length;
    const totalMessages = projects.reduce((sum, p) => sum + (p.messageCount || 0), 0);

    return {
      count: projects.length,
      active: activeProjects,
      withChats: projectsWithChats,
      totalMessages,
      text: `${projects.length} project${projects.length !== 1 ? "s" : ""} • ${activeProjects} ready`,
      chatsText: projectsWithChats > 0 ? ` • ${projectsWithChats} with chats` : "",
      messagesText: totalMessages > 0 ? ` • ${totalMessages} messages` : "",
    };
  }, [projects]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && prompt.trim()) {
        handleSubmit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prompt, handleSubmit]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="bg-black min-h-screen min-w-full flex flex-col items-center justify-center relative overflow-hidden"
      >
        {/* Authentication Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-6 right-6 z-20 flex items-center gap-4"
        >
          <SignedIn>
            {/* Supabase Config Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSupabaseConfig(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                isConfigValid
                  ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20"
                  : "bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20"
              }`}
              title={
                isConfigValid ? "Supabase configured" : "Configure Supabase"
              }
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">
                {isConfigValid ? "Backend Ready" : "Setup Backend"}
              </span>
              <div
                className={`w-2 h-2 rounded-full ${
                  isConfigValid ? "bg-green-500" : "bg-orange-500"
                }`}
              ></div>
            </motion.button>
          </SignedIn>

          <SignedOut>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <SignInButton>
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200">
                  Sign In
                </button>
              </SignInButton>
            </motion.div>
          </SignedOut>
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                  userButtonPopoverCard: "bg-neutral-900 border-neutral-700",
                  userButtonPopoverText: "text-white",
                },
              }}
            />
          </SignedIn>
        </motion.header>

        {/* Main Content Container */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6">
          {/* Title */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 1.2,
              ease: "easeOut",
              delay: 0.3,
            }}
            className="flex items-center justify-center mb-8"
          >
            {/* Logo */}
            <motion.div
              animate={{
                filter: [
                  "drop-shadow(0 0 0px rgba(255,255,255,0))",
                  "drop-shadow(0 0 20px rgba(255,255,255,0.3))",
                  "drop-shadow(0 0 0px rgba(255,255,255,0))",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <img
                src="/main.png"
                alt="CodePup Logo"
                className="w-24 h-24 md:w-32 md:h-32 object-contain"
              />
            </motion.div>

            {/* Title */}
            <motion.h1
              className="text-6xl px-2 md:text-8xl bg-gradient-to-b tracking-tighter from-white via-white to-transparent bg-clip-text text-transparent font-bold"
              animate={{
                textShadow: [
                  "0 0 0px rgba(255,255,255,0)",
                  "0 0 20px rgba(255,255,255,0.1)",
                  "0 0 0px rgba(255,255,255,0)",
                ],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              CodePup
            </motion.h1>
          </motion.div>

          {/* Content only visible when signed in */}
          <SignedIn>
            {/* Configuration Required Message */}
            {!isConfigValid && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.1 }}
                className="mb-8 text-center"
              >
                <div className="inline-flex items-center gap-2 px-4 py-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400">
                  <Database className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Backend configuration required to create projects
                  </span>
                  <button
                    onClick={() => setShowSupabaseConfig(true)}
                    className="ml-2 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 text-xs rounded transition-colors"
                  >
                    Configure Now
                  </button>
                </div>
              </motion.div>
            )}

            {/* Prompt Input Section */}
            <div className="flex flex-col items-center mb-12">
              <motion.textarea
                initial={{ y: 30, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  duration: 1,
                  ease: "easeOut",
                  delay: 1.2,
                }}
                whileFocus={{
                  scale: 1.02,
                  boxShadow: "0 0 0 2px rgba(96, 165, 250, 0.3)",
                }}
                value={prompt}
                onChange={handlePromptChange}
                placeholder={
                  !isConfigValid
                    ? "Configure backend settings first to create projects..."
                    : "Describe your project idea... (Ctrl/Cmd + Enter to create)"
                }
                className="mb-4 border-2 focus:outline-0 border-neutral-400 rounded-lg text-white p-3 w-full max-w-2xl h-36 bg-black/50 backdrop-blur-sm transition-all duration-300 placeholder-neutral-500"
                disabled={!isConfigValid}
              />

              <motion.button
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{
                  duration: 1,
                  ease: "easeOut",
                  delay: 1.5,
                }}
                whileHover={{
                  scale: isConfigValid && prompt.trim() ? 1.05 : 1,
                  boxShadow:
                    isConfigValid && prompt.trim()
                      ? "0 10px 25px rgba(96, 165, 250, 0.3)"
                      : "none",
                }}
                whileTap={{ scale: isConfigValid && prompt.trim() ? 0.95 : 1 }}
                className="w-fit px-7 rounded-lg py-2 bg-blue-400 hover:bg-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium"
                onClick={handleSubmit}
                disabled={isLoading || !prompt.trim() || !isConfigValid}
              >
                <motion.span
                  animate={
                    isLoading
                      ? {
                          opacity: [1, 0.5, 1],
                        }
                      : {}
                  }
                  transition={
                    isLoading
                      ? {
                          duration: 1,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }
                      : {}
                  }
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      Creating Project...
                    </span>
                  ) : !isConfigValid ? (
                    "Configure Backend First"
                  ) : (
                    "Create New Project"
                  )}
                </motion.span>
              </motion.button>
            </div>

            {/* Projects Section */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: 1.8,
              }}
              className="w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-white">
                  Your Projects
                </h2>
                <div className="text-right">
                  <div className="text-neutral-400 text-sm">
                    {projectStats.text}
                    {projectStats.chatsText}
                  </div>
                  {projectStats.totalMessages > 0 && (
                    <div className="text-neutral-500 text-xs">
                      {projectStats.totalMessages} total messages
                    </div>
                  )}
                </div>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full"
                  />
                </div>
              ) : projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {memoizedProjectCards}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <Code2 className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">
                    No projects yet
                  </h3>
                  <p className="text-neutral-400 mb-4">
                    {!isConfigValid
                      ? "Configure your backend settings to start creating projects"
                      : "Create your first project by entering a prompt above"}
                  </p>
                  {!isConfigValid && (
                    <button
                      onClick={() => setShowSupabaseConfig(true)}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg transition-colors text-sm"
                    >
                      Configure Backend
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          </SignedIn>

          {/* Message for signed out users */}
          <SignedOut>
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 1,
                ease: "easeOut",
                delay: 1.2,
              }}
              className="text-center"
            >
              <p className="text-neutral-400 mb-4">
                Please sign in to start building your projects
              </p>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <SignInButton>
                  <button className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors duration-200">
                    Get Started
                  </button>
                </SignInButton>
              </motion.div>
            </motion.div>
          </SignedOut>
        </div>
      </motion.div>

      {/* Supabase Configuration Form Modal */}
      <SupabaseConfigForm
        isOpen={showSupabaseConfig}
        onClose={() => setShowSupabaseConfig(false)}
        onSubmit={handleSupabaseConfigSubmit}
        initialConfig={supabaseConfig || {}}
      />
    </>
  );
};

export default Index;