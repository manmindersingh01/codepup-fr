import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { MyContext } from "../context/FrontendStructureContext";
import axios from "axios";
import {
  Send,
  Code,
  Loader2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Activity,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

type ProjectInfo = {
  id: number | null;
  name: string | null;
  isVerified: boolean;
};

interface LocationState {
  prompt?: string;
  projectId?: number;
  existingProject?: boolean;
  supabaseConfig?: any;
  clerkId?: string;
  userId?: number;
}

interface Project {
  id: number;
  name?: string;
  description?: string;
  deploymentUrl?: string;
  status?: "pending" | "building" | "ready" | "error";
  createdAt?: string;
  updatedAt?: string;
}

interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  isStreaming?: boolean;
}

interface ContextValue {
  value: any;
  setValue: (value: any) => void;
}

// Streaming interfaces
interface StreamingProgressData {
  type: "progress" | "length" | "chunk" | "complete" | "error" | "result";
  buildId: string;
  totalLength?: number;
  currentLength?: number;
  percentage?: number;
  chunk?: string;
  phase?: "generating" | "parsing" | "processing" | "deploying" | "complete";
  message?: string;
  error?: string;
  result?: any;
}

interface StreamingStats {
  totalCharacters: number;
  chunksReceived: number;
  estimatedTotalChunks: number;
  startTime: number;
  endTime?: number;
  bytesPerSecond?: number;
}

const ChatPage: React.FC = () => {
  const context = useContext(MyContext);
  const { value } = context as ContextValue;
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [projectStatus, setProjectStatus] = useState<
    "idle" | "loading" | "ready" | "error" | "fetching"
  >("idle");
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  // Streaming state
  const [isStreamingGeneration, setIsStreamingGeneration] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [streamingPhase, setStreamingPhase] = useState<string>("");
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [streamingStats, setStreamingStats] = useState<StreamingStats>({
    totalCharacters: 0,
    chunksReceived: 0,
    estimatedTotalChunks: 0,
    startTime: 0,
  });
  const [showStreamingDetails, setShowStreamingDetails] = useState(false);

  // Project matching state
  const [currentProjectInfo, setCurrentProjectInfo] = useState<ProjectInfo>({
    id: null,
    name: null,
    isVerified: false,
  });

  // Refs to prevent duplicate API calls
  const hasInitialized = useRef(false);
  const isGenerating = useRef(false);
  const currentProjectId = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const projectLoaded = useRef(false);
  const healthCheckDone = useRef(false);

  const location = useLocation();
  const {
    prompt: navPrompt,
    projectId,
    existingProject,
    supabaseConfig,
    clerkId,
    userId: passedUserId,
  } = (location.state as LocationState) || {};

  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Auto-scroll to bottom when messages change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Get deployed app URL from current context
  const getDeployedAppUrl = useCallback((): string | undefined => {
    if (previewUrl && !previewUrl.includes("localhost")) {
      return previewUrl;
    }

    const hostname = window.location.hostname;
    if (
      hostname.includes("azurestaticapps.net") ||
      hostname.includes("ashy-") ||
      hostname.includes("netlify.app") ||
      hostname.includes("vercel.app") ||
      !hostname.includes("localhost")
    ) {
      return window.location.origin;
    }

    const storedProject = sessionStorage.getItem("currentProject");
    if (storedProject) {
      try {
        const project = JSON.parse(storedProject);
        return project.deploymentUrl;
      } catch (e) {
        console.warn("Failed to parse stored project data");
      }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const deployedUrl = urlParams.get("deployedUrl");
    if (deployedUrl) {
      return deployedUrl;
    }

    return undefined;
  }, [previewUrl]);

  // Get current user ID - matching Index.tsx pattern
  const getCurrentUserId = useCallback((): number => {
    // First try to use the passed userId from navigation state
    if (passedUserId) {
      return passedUserId;
    }

    // Then try to get from localStorage dbUser (matching Index.tsx pattern)
    const storedDbUser = localStorage.getItem('dbUser');
    if (storedDbUser) {
      try {
        const parsedUser = JSON.parse(storedDbUser);
        return parsedUser.id;
      } catch (e) {
        console.warn("Failed to parse stored dbUser");
      }
    }

    // Finally try the legacy userId storage
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId && !isNaN(parseInt(storedUserId))) {
      return parseInt(storedUserId);
    }

    // Fallback
    return 1;
  }, [passedUserId]);

  const getprojectId = useCallback((): number | null => {
    const storedProjectId = localStorage.getItem("projectId");
    if (storedProjectId && !isNaN(parseInt(storedProjectId))) {
      return parseInt(storedProjectId);
    }
    return null;
  }, []);

  // Handle streaming generation progress
  const handleStreamingData = useCallback((data: StreamingProgressData) => {
    console.log("📡 Streaming data received:", data.type, data.message);

    switch (data.type) {
      case "progress":
        setStreamingProgress(data.percentage || 0);
        setStreamingPhase(data.phase || "");
        setStreamingMessage(data.message || "");
        break;

      case "length":
        setStreamingStats((prev) => ({
          ...prev,
          totalCharacters: data.currentLength || 0,
          bytesPerSecond: prev.startTime
            ? (data.currentLength || 0) / ((Date.now() - prev.startTime) / 1000)
            : 0,
        }));
        setStreamingProgress(data.percentage || 0);
        break;

      case "chunk":
        if (data.chunk) {
          setStreamingStats((prev) => ({
            ...prev,
            chunksReceived: prev.chunksReceived + 1,
            totalCharacters: data.currentLength || prev.totalCharacters,
            estimatedTotalChunks: Math.ceil((data.totalLength || 0) / 10000),
          }));
        }
        break;

      case "complete":
        setStreamingProgress(100);
        setStreamingPhase("complete");
        setStreamingMessage(data.message || "Generation completed!");
        setStreamingStats((prev) => ({
          ...prev,
          endTime: Date.now(),
        }));
        break;

      case "result":
        if (data.result) {
          setPreviewUrl(data.result.previewUrl);
          setProjectStatus("ready");

          const completionMessage: Message = {
            id: `completion-${Date.now()}`,
            content: `🎉 Project generated successfully!\n\n**Statistics:**\n- Total characters: ${
              data.result.streamingStats?.totalCharacters || "N/A"
            }\n- Chunks streamed: ${
              data.result.streamingStats?.chunksStreamed || 0
            }\n- Files created: ${
              data.result.files?.length || 0
            }\n\n[View Preview](${data.result.previewUrl})`,
            type: "assistant",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, completionMessage]);
          
          // Update current project info
          if (data.result.projectId) {
            setCurrentProjectInfo({
              id: data.result.projectId,
              name: `Project ${data.result.projectId}`,
              isVerified: true,
            });
            setCurrentProject({
              id: data.result.projectId,
              name: `Generated Project`,
              deploymentUrl: data.result.previewUrl,
              status: "ready",
            });
          }
        }
        setIsStreamingGeneration(false);
        break;

      case "error":
        setError(data.error || "Generation failed");
        setIsStreamingGeneration(false);
        setProjectStatus("error");
        break;
    }
  }, []);

  // Start streaming generation
  const startStreamingGeneration = useCallback(
    async (userPrompt: string, projId?: number) => {
      if (isGenerating.current || isStreamingGeneration) {
        console.log("🔄 Generation already in progress, skipping...");
        return;
      }

      isGenerating.current = true;
      setIsStreamingGeneration(true);
      setError("");
      setProjectStatus("loading");
      setStreamingProgress(0);
      setStreamingPhase("generating");
      setStreamingMessage("Starting generation...");
      setStreamingStats({
        totalCharacters: 0,
        chunksReceived: 0,
        estimatedTotalChunks: 0,
        startTime: Date.now(),
      });

      try {
        console.log(`🚀 Starting streaming generation for: "${userPrompt.substring(0, 50)}..."`);

        const response = await fetch(`${baseUrl}/api/generate/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: userPrompt,
            projectId: projId,
            supabaseUrl: supabaseConfig?.supabaseUrl,
            supabaseAnonKey: supabaseConfig?.supabaseAnonKey,
            supabaseToken: supabaseConfig?.supabaseToken,
            databaseUrl: supabaseConfig?.databaseUrl,
            userId: getCurrentUserId(),
            clerkId: clerkId, // Add clerkId to the request
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: StreamingProgressData = JSON.parse(line.slice(6));
                handleStreamingData(data);
              } catch (e) {
                console.warn("Error parsing streaming data:", e);
              }
            }
          }
        }

        console.log("✅ Streaming generation completed");
      } catch (error) {
        console.error("❌ Streaming generation failed:", error);
        setError(error instanceof Error ? error.message : "Generation failed");
        setIsStreamingGeneration(false);
        setProjectStatus("error");
      } finally {
        isGenerating.current = false;
      }
    },
    [baseUrl, supabaseConfig, handleStreamingData, getCurrentUserId, isStreamingGeneration, clerkId]
  );

  // Stop streaming generation
  const stopStreamingGeneration = useCallback(() => {
    setIsStreamingGeneration(false);
    isGenerating.current = false;
    setStreamingPhase("stopped");
    setStreamingMessage("Generation stopped by user");
  }, []);

  // Server health check
  const checkServerHealth = useCallback(async () => {
    if (healthCheckDone.current) {
      return isServerHealthy;
    }

    try {
      console.log("🔍 Checking server health...");
      const healthResponse = await axios.get(`${baseUrl}/health`, {
        timeout: 10000,
      });
      console.log("✅ Server is running:", healthResponse.data);
      setIsServerHealthy(true);
      setError("");
      healthCheckDone.current = true;
      return true;
    } catch (error) {
      console.error("❌ Server health check failed:", error);
      setIsServerHealthy(false);
      healthCheckDone.current = true;

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
          setError("Backend server is not responding. Please ensure it's running on the correct port.");
        } else {
          setError(`Server error: ${error.response?.status || "Unknown"}`);
        }
      } else {
        setError("Cannot connect to server");
      }
      return false;
    }
  }, [baseUrl, isServerHealthy]);

  // Load project details
  const loadProject = useCallback(async (projId: number) => {
    if (currentProjectId.current === projId && projectStatus !== "idle") {
      return;
    }

    setError("");
    setProjectStatus("fetching");
    currentProjectId.current = projId;

    try {
      console.log(`🔍 Loading project details for ID: ${projId}`);
      const res = await axios.get<Project>(`${baseUrl}/api/projects/${projId}`);
      const project = res.data;

      console.log("📋 Project details:", project);
      setCurrentProject(project);

      // Update currentProjectInfo regardless of status
      setCurrentProjectInfo({
        id: projId,
        name: project.name || `Project ${projId}`,
        isVerified: true,
      });

      // Always set preview URL if deploymentUrl exists
      if (project.deploymentUrl) {
        console.log("🔗 Setting preview URL:", project.deploymentUrl);
        setPreviewUrl(project.deploymentUrl);
      }

      // Handle different project statuses
      if (project.status === "ready") {
        console.log("✅ Project is ready");
        setProjectStatus("ready");
      } else if (project.status === "regenerating") {
        console.log("🔄 Project is regenerating but has deployment URL");
        setProjectStatus("ready"); // Treat as ready since it has a deployment
      } else if (project.status === "building" || project.status === "pending") {
        console.log("🔨 Project is still building");
        setProjectStatus("loading");
      } else if (project.status === "error") {
        if (project.deploymentUrl) {
          console.log("⚠️ Project has error but deployment exists");
          setProjectStatus("ready"); // Has deployment, treat as ready
        } else {
          setError("Project build failed. Please try regenerating the project.");
          setProjectStatus("error");
        }
      } else {
        console.log("📝 Project found but deployment not ready");
        if (navPrompt) {
          console.log("🚀 Triggering streaming build with navigation prompt");
          await startStreamingGeneration(navPrompt, projId);
        } else {
          setError("Project found, but deployment is not ready and no prompt available to rebuild.");
          setProjectStatus("error");
        }
      }
    } catch (error) {
      console.error("❌ Error loading project:", error);
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setError(`Project with ID ${projId} not found.`);
      } else {
        setError("Failed to load project");
      }
      setProjectStatus("error");
    }
  }, [baseUrl, projectStatus, navPrompt, startStreamingGeneration]);

  // Load project messages
  const loadProjectMessages = useCallback(async (projectId: number) => {
    if (projectLoaded.current) {
      console.log("🔄 Project messages already loaded, skipping...");
      return;
    }

    try {
      console.log(`📋 Loading messages for project ${projectId}...`);
      const response = await axios.get(`${baseUrl}/api/messages/project/${projectId}`);

      if (response.data.success && response.data.data) {
        const history = response.data.data;
        const formattedMessages: Message[] = history.map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          content: msg.content,
          type: msg.role === "user" ? "user" : "assistant",
          timestamp: new Date(msg.createdAt || msg.timestamp),
        }));

        setMessages(formattedMessages);
        console.log(`✅ Loaded ${formattedMessages.length} project messages`);
      } else {
        console.log("📭 No messages found for project:", projectId);
        setMessages([]);
      }
      projectLoaded.current = true;
    } catch (error) {
      console.error("Error loading project messages:", error);
      setMessages([]);
      projectLoaded.current = true;
    }
  }, [baseUrl]);

  // Handle streaming response for modifications
  const handleStreamingResponse = useCallback(async (currentPrompt: string) => {
    console.log("🔧 MODIFICATION ENDPOINT CALLED!");
    console.log("🔧 Prompt:", currentPrompt.substring(0, 50) + "...");
    
    try {
      setIsStreamingResponse(true);

      const streamingMessage: Message = {
        id: `streaming-${Date.now()}`,
        content: "",
        type: "assistant",
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, streamingMessage]);

      const deployedUrl = getDeployedAppUrl();
      const userId = getCurrentUserId();

      console.log("🚀 Sending modification request to /api/modify/stream:", {
        prompt: currentPrompt.substring(0, 50) + "...",
        userId: userId,
        projectId: currentProjectInfo.id || projectId,
        currentUrl: window.location.href,
        deployedUrl: deployedUrl,
      });

      const response = await fetch(`${baseUrl}/api/modify/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          userId: userId,
          projectId: currentProjectInfo.id || projectId,
          currentUrl: window.location.href,
          deployedUrl: deployedUrl,
          projectStructure: value,
          clerkId: clerkId,
        }),
      });

      console.log("🔧 Modification response status:", response.status);

      if (!response.ok) {
        throw new Error(`Streaming request failed with status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let accumulatedContent = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            const eventType = line.slice(7);
            console.log("🔧 Event type:", eventType);
            continue;
          }
          
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              console.log("🔧 Modification data:", data);

              // Handle different event types from modification endpoint
              if (data.step && data.message) {
                // Progress event
                const progressMessage = `Step ${data.step}/${data.total}: ${data.message}`;
                accumulatedContent = progressMessage;
                
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === streamingMessage.id
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  )
                );
              } else if (data.success && data.data) {
                // Completion event
                const completionMessage = `✅ Modification completed successfully!\n\n**Project Updated:**\n- Project ID: ${data.data.projectId}\n- Build ID: ${data.data.buildId}\n\n[View Live Preview](${data.data.previewUrl})`;
                
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === streamingMessage.id
                      ? { ...msg, content: completionMessage, isStreaming: false }
                      : msg
                  )
                );

                // Update preview URL and project status
                if (data.data.previewUrl) {
                  console.log("🔗 Updating preview URL from modification:", data.data.previewUrl);
                  setPreviewUrl(data.data.previewUrl);
                  setProjectStatus("ready");
                  
                  // Update current project with new URL
                  setCurrentProject(prev => prev ? {
                    ...prev,
                    deploymentUrl: data.data.previewUrl,
                    status: "ready"
                  } : null);
                }
                break;
              } else if (data.error) {
                // Error event
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON lines
              console.warn("Error parsing modification data:", e);
            }
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === streamingMessage.id ? { ...msg, isStreaming: false } : msg
        )
      );

      // Refresh project details after modifications
      if (currentProject?.id) {
        console.log("🔄 Refreshing project details after modification");
        await loadProject(currentProject.id);
      }
    } catch (error) {
      console.error("❌ Error in streaming response:", error);
      setMessages((prev) => prev.filter((msg) => msg.id !== streamingMessage.id));

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error while processing your request.",
        type: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsStreamingResponse(false);
    }
  }, [
    baseUrl,
    value,
    projectId,
    currentProjectInfo.id,
    getDeployedAppUrl,
    getCurrentUserId,
    currentProject?.id,
    loadProject,
    clerkId,
  ]);

  // Save message to backend
  const saveMessage = useCallback(async (content: string, role: "user" | "assistant") => {
    if (!projectId) return;

    try {
      await axios.post(`${baseUrl}/api/messages`, {
        projectId,
        role,
        content,
        metadata: {
          projectId,
          userId: getCurrentUserId(),
          clerkId: clerkId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.warn("Could not save message:", error);
    }
  }, [baseUrl, projectId, getCurrentUserId, clerkId]);

  // Handle user prompt submission
  const handleSubmit = useCallback(async () => {
    if (!prompt.trim() || isLoading || isStreamingGeneration) return;

    setIsLoading(true);
    setError("");

    const newMessage: Message = {
      id: Date.now().toString(),
      content: prompt,
      type: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    const currentPrompt = prompt;
    setPrompt("");

    await saveMessage(currentPrompt, "user");

    try {
      // Enhanced debugging for endpoint selection
      console.log("🔍 DEBUGGING ENDPOINT SELECTION:");
      console.log("  currentProject:", currentProject);
      console.log("  currentProject?.status:", currentProject?.status);
      console.log("  currentProject?.deploymentUrl:", currentProject?.deploymentUrl);
      console.log("  projectId:", projectId);
      console.log("  currentProjectInfo:", currentProjectInfo);
      
      // Determine if this should be a modification or new generation
      const shouldUseModification = currentProject && 
                                   (currentProject.status === "ready" || 
                                    currentProject.status === "regenerating") &&
                                   currentProject.deploymentUrl &&
                                   currentProject.deploymentUrl.trim() !== "";
      
      console.log(`🎯 DECISION: Using ${shouldUseModification ? 'MODIFICATION' : 'GENERATION'} endpoint`);
      console.log(`📋 Criteria: project=${!!currentProject}, status=${currentProject?.status}, hasUrl=${!!currentProject?.deploymentUrl}`);

      if (shouldUseModification) {
        console.log("🔧 CALLING MODIFICATION ENDPOINT");
        // Use modification endpoint for existing ready projects
        await handleStreamingResponse(currentPrompt);
      } else {
        console.log("🆕 CALLING GENERATION ENDPOINT");
        // Use generation endpoint for new projects or projects not ready
        await startStreamingGeneration(currentPrompt, projectId);
      }
    } catch (error) {
      console.error("Error handling submit:", error);
      setError("Failed to process request");

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I encountered an error while processing your request.",
        type: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      await saveMessage(errorMessage.content, "assistant");
    } finally {
      setIsLoading(false);
    }
  }, [
    prompt,
    isLoading,
    isStreamingGeneration,
    projectId,
    currentProject,
    saveMessage,
    handleStreamingResponse,
    startStreamingGeneration,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  }, []);

  // Clear conversation
  const clearConversation = useCallback(async () => {
    if (projectId) {
      try {
        await axios.delete(`${baseUrl}/api/messages/project/${projectId}`);
        setMessages([]);
      } catch (error) {
        console.error("Error clearing conversation:", error);
        setError("Failed to clear conversation");
      }
    } else {
      setMessages([]);
    }
  }, [baseUrl, projectId]);

  // Retry connection
  const retryConnection = useCallback(async () => {
    setIsRetrying(true);
    setError("");
    setProjectStatus("loading");

    // Reset refs
    healthCheckDone.current = false;
    projectLoaded.current = false;
    hasInitialized.current = false;

    try {
      const isHealthy = await checkServerHealth();
      if (isHealthy) {
        if (existingProject && projectId) {
          await loadProject(projectId);
          await loadProjectMessages(projectId);
        } else if (navPrompt && projectId) {
          setPrompt(navPrompt);
          await startStreamingGeneration(navPrompt, projectId);
        } else {
          setProjectStatus("idle");
        }
        hasInitialized.current = true;
      }
    } catch (error) {
      setError("Still cannot connect to server. Please check your backend setup.");
      setProjectStatus("error");
    } finally {
      setIsRetrying(false);
    }
  }, [
    checkServerHealth,
    existingProject,
    projectId,
    navPrompt,
    loadProject,
    loadProjectMessages,
    startStreamingGeneration,
  ]);

  // Format streaming duration
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }, []);

  // Format bytes per second
  const formatSpeed = useCallback((bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }, []);

  // MAIN INITIALIZATION
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const initialize = async () => {
      console.log("🚀 Starting ChatPage initialization...");

      const serverHealthy = await checkServerHealth();
      if (!serverHealthy) {
        setProjectStatus("error");
        return;
      }

      if (existingProject && projectId) {
        console.log("📂 Loading existing project...");
        await loadProject(projectId);
        await loadProjectMessages(projectId);
      } else if (navPrompt && projectId) {
        console.log("🎨 Generating new project with streaming...");
        setPrompt(navPrompt);
        await startStreamingGeneration(navPrompt, projectId);
      } else if (projectId) {
        console.log("🔍 Loading project preview only...");
        await loadProject(projectId);
        await loadProjectMessages(projectId);
      } else {
        console.log("⭐ Ready for user input");
        setProjectStatus("idle");
      }

      console.log("✅ ChatPage initialization complete");
    };

    initialize();
  }, [
    checkServerHealth,
    loadProject,
    loadProjectMessages,
    startStreamingGeneration,
    existingProject,
    projectId,
    navPrompt,
  ]);

  return (
    <div className="w-full bg-gradient-to-br from-black via-neutral-950 to-black h-screen flex">
      {/* Chat Section - 25% width */}
      <div className="w-1/4 flex flex-col border-r border-slate-700/50">
        {/* Header */}
        <div className="bg-slate-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <a href="/" className="text-xl font-semibold text-white">
                CodePup
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearConversation}
                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                title="Clear conversation"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {isStreamingGeneration && (
                <button
                  onClick={stopStreamingGeneration}
                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                  title="Stop generation"
                >
                  <Activity className="w-4 h-4" />
                </button>
              )}
              {isServerHealthy === false && (
                <button
                  onClick={retryConnection}
                  disabled={isRetrying}
                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                  title="Retry connection"
                >
                  {isRetrying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Streaming Progress Section */}
        {isStreamingGeneration && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-blue-500/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img
                  src="/main.png"
                  alt="CodePup Logo"
                  className="w-8 h-8 md:w-8 md:h-8 object-contain"
                />
                <span className="text-xs font-medium text-blue-400">STREAMING GENERATION</span>
                <button
                  onClick={() => setShowStreamingDetails(!showStreamingDetails)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  {showStreamingDetails ? "−" : "+"}
                </button>
              </div>
              <span className="text-xs text-blue-300">{streamingProgress.toFixed(0)}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800/50 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${streamingProgress}%` }}
              ></div>
            </div>

            {/* Phase and Message */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-400 capitalize">
                  {streamingPhase}
                </span>
                {streamingPhase === "generating" && (
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                    <div
                      className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-300 line-clamp-2">{streamingMessage}</p>
            </div>

            {/* Streaming Stats */}
            {streamingStats.totalCharacters > 0 && (
              <div className="mt-2 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>{streamingStats.totalCharacters.toLocaleString()} chars</span>
                  <span>
                    {streamingStats.chunksReceived}/{streamingStats.estimatedTotalChunks || "?"} chunks
                  </span>
                </div>
                {streamingStats.bytesPerSecond && streamingStats.bytesPerSecond > 0 && (
                  <div className="flex justify-between mt-1">
                    <span>Speed: {formatSpeed(streamingStats.bytesPerSecond)}</span>
                    <span>Duration: {formatDuration(Date.now() - streamingStats.startTime)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Detailed Streaming Info */}
            {showStreamingDetails && (
              <div className="mt-3 p-2 bg-slate-800/30 rounded text-xs">
                <div className="space-y-1">
                  <div>Total Characters: {streamingStats.totalCharacters.toLocaleString()}</div>
                  <div>Chunks Received: {streamingStats.chunksReceived}</div>
                  <div>Estimated Total Chunks: {streamingStats.estimatedTotalChunks || "Unknown"}</div>
                  {streamingStats.bytesPerSecond && (
                    <div>Speed: {formatSpeed(streamingStats.bytesPerSecond)}</div>
                  )}
                  <div>Elapsed: {formatDuration(Date.now() - streamingStats.startTime)}</div>
                  {streamingStats.endTime && (
                    <div>
                      Total Duration: {formatDuration(streamingStats.endTime - streamingStats.startTime)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

            {/* User Info Display */}
            {(passedUserId || clerkId) && (
              <div className="bg-slate-800/30 border-b border-slate-700/50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-medium text-blue-400">USER SESSION</span>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  {passedUserId && <div>User ID: {passedUserId}</div>}
                  {clerkId && <div>Clerk ID: {clerkId.substring(0, 8)}...</div>}
                </div>
              </div>
            )}
        {currentProject && (
          <div className="bg-slate-800/30 border-b border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">PROJECT</span>
              {currentProjectInfo.isVerified && (
                <div className="w-2 h-2 rounded-full bg-green-500" title="Project verified"></div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">
                {currentProject.name || `Project ${currentProject.id}`}
              </p>
              {currentProject.description && (
                <p className="text-xs text-slate-300 line-clamp-2">{currentProject.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    currentProject.status === "ready"
                      ? "bg-green-500/20 text-green-400"
                      : currentProject.status === "building"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : currentProject.status === "error"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {currentProject.status || "unknown"}
                </span>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-slate-400 hover:text-white transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Server Status */}
        {isServerHealthy === false && (
          <div className="bg-red-500/10 border-b border-red-500/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-medium text-red-400">SERVER OFFLINE</span>
            </div>
            <p className="text-xs text-red-300">Cannot connect to backend server</p>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
              {error.includes("Cannot connect") && (
                <button
                  onClick={retryConnection}
                  disabled={isRetrying}
                  className="mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded transition-colors disabled:opacity-50"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                      Retrying...
                    </>
                  ) : (
                    "Retry Connection"
                  )}
                </button>
              )}
            </div>
          )}

          {messages.length === 0 && (projectStatus === "loading" || projectStatus === "fetching" || isStreamingGeneration) ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4">
                {isStreamingGeneration ? (
                  <img src="/main.png" alt="CodePup Logo" className="w-16 h-16 md:w-8 md:h-8 object-contain" />
                ) : (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                )}
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {isStreamingGeneration
                  ? "Streaming Generation"
                  : projectStatus === "fetching"
                  ? "Fetching Project"
                  : existingProject
                  ? "Loading Project"
                  : "Generating Code"}
              </h3>
              <p className="text-slate-400 max-w-sm text-sm">
                {isStreamingGeneration
                  ? `${streamingPhase} • ${streamingProgress.toFixed(0)}% complete`
                  : projectStatus === "fetching"
                  ? "Fetching project details and deployment status..."
                  : existingProject
                  ? "Loading your project preview..."
                  : "We are generating code files please wait"}
              </p>
              {currentProject && (
                <div className="mt-3 text-xs text-slate-500">
                  Project ID: {currentProject.id} • Status: {currentProject.status}
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4">
                <Code className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Ready to Chat</h3>
              <p className="text-slate-400 max-w-sm text-sm">
                {currentProject && currentProject.status === "ready"
                  ? "Your project is ready! Start describing changes you'd like to make."
                  : "Start describing your project or changes you'd like to make"}
              </p>
              {currentProject && (
                <div className="mt-3 text-xs text-slate-500">Project: {currentProject.name || currentProject.id}</div>
              )}
            </div>
          ) : (
            <>
              {messages
                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
                .map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg ${
                      message.type === "user" ? "bg-blue-600/20 ml-4" : "bg-slate-800/30 mr-4"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <p className="text-white text-sm flex-1">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                        )}
                      </p>
                      {message.isStreaming && <Loader2 className="w-3 h-3 text-slate-400 animate-spin mt-0.5" />}
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/30 backdrop-blur-sm border-t border-slate-700/50">
          <div className="relative">
            <textarea
              className="w-full bg-black/50 border border-slate-600/50 rounded-xl text-white p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none transition-all duration-200 placeholder-slate-400 text-sm"
              value={prompt}
              onChange={handlePromptChange}
              onKeyPress={handleKeyPress}
              placeholder={
                isServerHealthy === false
                  ? "Server offline..."
                  : isStreamingGeneration
                  ? "Generation in progress..."
                  : "Describe your project or changes..."
              }
              rows={2}
              disabled={
                isLoading ||
                projectStatus === "loading" ||
                projectStatus === "fetching" ||
                isStreamingResponse ||
                isStreamingGeneration ||
                isServerHealthy === false
              }
              maxLength={1000}
            />
            <button
              onClick={handleSubmit}
              disabled={
                !prompt.trim() ||
                isLoading ||
                projectStatus === "loading" ||
                projectStatus === "fetching" ||
                isStreamingResponse ||
                isStreamingGeneration ||
                isServerHealthy === false
              }
              className="absolute bottom-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
            >
              {isLoading || isStreamingResponse || isStreamingGeneration ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
            <span>
              {isServerHealthy === false
                ? "Server offline - check connection"
                : isStreamingGeneration
                ? "Streaming generation in progress..."
                : "Enter to send, Shift+Enter for new line"}
            </span>
            <span>{prompt.length}/1000</span>
          </div>
        </div>
      </div>

      {/* Preview Section - 75% width */}
      <div className="w-3/4 flex flex-col bg-slate-900/50">
        {/* Preview Header */}
        <div className="bg-black/50 backdrop-blur-sm border-b border-slate-700/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Live Preview</h2>
            <div className="flex items-center gap-4">
              {/* Streaming Status Indicator */}
              {isStreamingGeneration && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-blue-400">Streaming {streamingPhase}</span>
                  <span className="text-slate-400">{streamingProgress.toFixed(0)}%</span>
                </div>
              )}
              {(projectId || currentProjectInfo.id) && (
                <span className="text-xs text-slate-400">Project: {projectId || currentProjectInfo.id}</span>
              )}
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </a>
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isServerHealthy === false
                      ? "bg-red-500"
                      : isStreamingGeneration
                      ? "bg-blue-500 animate-pulse"
                      : projectStatus === "ready"
                      ? "bg-green-500"
                      : projectStatus === "loading" || projectStatus === "fetching"
                      ? "bg-yellow-500"
                      : projectStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-500"
                  }`}
                ></div>
                <span className="text-xs text-slate-400 capitalize">
                  {isServerHealthy === false
                    ? "offline"
                    : isStreamingGeneration
                    ? "streaming"
                    : projectStatus}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4">
          <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden">
            {previewUrl && isServerHealthy !== false && !isStreamingGeneration ? (
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onError={(e) => {
                  console.error("Iframe load error:", e);
                  setError("Failed to load preview. The deployment might not be ready yet.");
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-slate-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    {isServerHealthy === false ? (
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    ) : isStreamingGeneration ? (
                      <img src="/main.png" alt="CodePup Logo" className="w-16 h-16 md:w-8 md:h-8 object-contain" />
                    ) : isGenerating.current || projectStatus === "loading" || projectStatus === "fetching" ? (
                      <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    ) : (
                      <Code className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <p className="text-slate-600 mb-4">
                    {isServerHealthy === false
                      ? "Server is offline - cannot load preview"
                      : isStreamingGeneration
                      ? `Streaming generation in progress: ${streamingPhase} (${streamingProgress.toFixed(0)}%)`
                      : projectStatus === "fetching"
                      ? "Fetching project details..."
                      : isGenerating.current
                      ? existingProject
                        ? "Loading preview..."
                        : "Generating preview..."
                      : projectStatus === "error"
                      ? "Failed to load preview"
                      : currentProject?.status === "building"
                      ? "Project is building - please wait..."
                      : currentProject?.status === "pending"
                      ? "Project build is pending..."
                      : "Preview will appear here"}
                  </p>

                  {/* Streaming Progress Details in Preview */}
                  {isStreamingGeneration && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${streamingProgress}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>
                          Phase: <span className="font-medium text-blue-600 capitalize">{streamingPhase}</span>
                        </div>
                        {streamingStats.totalCharacters > 0 && (
                          <div>
                            Generated:{" "}
                            <span className="font-medium">{streamingStats.totalCharacters.toLocaleString()}</span>{" "}
                            characters
                          </div>
                        )}
                        {streamingStats.chunksReceived > 0 && (
                          <div>
                            Chunks: <span className="font-medium">{streamingStats.chunksReceived}</span> received
                          </div>
                        )}
                        {streamingStats.bytesPerSecond && streamingStats.bytesPerSecond > 0 && (
                          <div>
                            Speed: <span className="font-medium">{formatSpeed(streamingStats.bytesPerSecond)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {currentProject &&
                    currentProject.status &&
                    currentProject.status !== "ready" &&
                    !isStreamingGeneration && (
                      <div className="text-xs text-slate-500 mb-4">
                        Project Status: {currentProject.status}
                        {currentProject.status === "building" && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: "60%" }}></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {(isServerHealthy === false || projectStatus === "error") && !isStreamingGeneration && (
                    <button
                      onClick={retryConnection}
                      disabled={isRetrying}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg transition-colors text-sm"
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                          Reconnecting...
                        </>
                      ) : (
                        "Retry Connection"
                      )}
                    </button>
                  )}

                  {/* Stop streaming button in preview */}
                  {isStreamingGeneration && (
                    <button
                      onClick={stopStreamingGeneration}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm ml-2"
                    >
                      <Activity className="w-4 h-4 inline mr-2" />
                      Stop Generation
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;