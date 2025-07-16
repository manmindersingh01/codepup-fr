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
  CheckCircle,
  Clock,
  FileText,
  Database,
  Palette,
  Monitor,
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
  fromWorkflow?: boolean;
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
  workflowStep?: string;
  stepData?: any;
}

interface ContextValue {
  value: any;
  setValue: (value: any) => void;
}

interface WorkflowStepData {
  step: string;
  message: string;
  data?: any;
  isComplete?: boolean;
  error?: string;
}

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

  // Basic states
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

  // Workflow states
  const [isWorkflowActive, setIsWorkflowActive] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string>("");
  const [workflowProgress, setWorkflowProgress] = useState(0);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepData[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  // Streaming states
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

  // Project states
  const [currentProjectInfo, setCurrentProjectInfo] = useState<ProjectInfo>({
    id: null,
    name: null,
    isVerified: false,
  });

  // Refs
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
    fromWorkflow,
  } = (location.state as LocationState) || {};

  const baseUrl = import.meta.env.VITE_BASE_URL;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Get current user ID
  const getCurrentUserId = useCallback((): number => {
    if (passedUserId) {
      return passedUserId;
    }

    const storedDbUser = localStorage.getItem("dbUser");
    if (storedDbUser) {
      try {
        const parsedUser = JSON.parse(storedDbUser);
        return parsedUser.id;
      } catch (e) {
        console.warn("Failed to parse stored dbUser");
      }
    }

    const storedUserId = localStorage.getItem("userId");
    if (storedUserId && !isNaN(parseInt(storedUserId))) {
      return parseInt(storedUserId);
    }

    return 1;
  }, [passedUserId]);

  // Get deployed app URL
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

  // Add workflow step
  const addWorkflowStep = useCallback((stepData: WorkflowStepData) => {
    setWorkflowSteps((prev) => [...prev, stepData]);
    setCurrentWorkflowStep(stepData.step);

    const stepMessage: Message = {
      id: `workflow-${Date.now()}`,
      content: `**${stepData.step}**: ${stepData.message}`,
      type: "assistant",
      timestamp: new Date(),
      workflowStep: stepData.step,
      stepData: stepData.data,
    };

    setMessages((prev) => [...prev, stepMessage]);
  }, []);

  // Update workflow step
  const updateWorkflowStep = useCallback(
    (step: string, updates: Partial<WorkflowStepData>) => {
      setWorkflowSteps((prev) =>
        prev.map((s) => (s.step === step ? { ...s, ...updates } : s))
      );

      setMessages((prev) =>
        prev.map((msg) =>
          msg.workflowStep === step
            ? {
                ...msg,
                content: `**${step}**: ${
                  updates.message || msg.content.split(": ")[1]
                }`,
              }
            : msg
        )
      );
    },
    []
  );

  // Complete workflow sequence
  const startCompleteWorkflow = useCallback(
    async (userPrompt: string, projId: number) => {
      console.log(
        `🚀 Starting complete workflow for project ${projId} with prompt: "${userPrompt}"`
      );

      if (isWorkflowActive || isGenerating.current) {
        console.log("🔄 Workflow already in progress, skipping...");
        return;
      }

      if (
        !supabaseConfig ||
        !supabaseConfig.supabaseUrl ||
        !supabaseConfig.supabaseAnonKey
      ) {
        setError(
          "Supabase configuration is missing. Please ensure backend is properly configured."
        );
        return;
      }

      setIsWorkflowActive(true);
      setIsLoading(true);
      setError("");
      setProjectStatus("loading");
      setWorkflowProgress(0);
      setWorkflowSteps([]);
      isGenerating.current = true;

      try {
        // Step 1: Generate design files
        addWorkflowStep({
          step: "Design Generation",
          message: "Generating design files and structure...",
          isComplete: false,
        });
        setWorkflowProgress(20);

        console.log(
          `🎨 Step 1: Calling /api/design/generate for project ${projId}`
        );
        const generateResponse = await axios.post(
          `${baseUrl}/api/design/generate`,
          {
            projectId: projId,
            prompt: userPrompt, // Include the prompt
          }
        );

        if (!generateResponse.data.success) {
          throw new Error(
            generateResponse.data.error || "Failed to generate design files"
          );
        }

        updateWorkflowStep("Design Generation", {
          message: `✅ Generated ${
            generateResponse.data.files
              ? Object.keys(generateResponse.data.files).length
              : 0
          } design files successfully!`,
          isComplete: true,
          data: generateResponse.data,
        });
        setWorkflowProgress(40);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Step 2: Plan structure
        addWorkflowStep({
          step: "Structure Planning",
          message: "Planning file structure and documentation...",
          isComplete: false,
        });

        console.log(
          `📋 Step 2: Calling /api/design/plan-structure for project ${projId}`
        );
        const planResponse = await axios.post(
          `${baseUrl}/api/design/plan-structure`,
          {
            projectId: projId,
          }
        );

        if (!planResponse.data.success) {
          throw new Error(
            planResponse.data.error || "Failed to plan structure"
          );
        }

        updateWorkflowStep("Structure Planning", {
          message: `✅ Planned structure with ${
            planResponse.data.totalFileCount || 0
          } files!`,
          isComplete: true,
          data: planResponse.data,
        });
        setWorkflowProgress(60);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Step 3: Generate backend
        addWorkflowStep({
          step: "Backend Generation",
          message:
            "Generating backend files, database schema, and API endpoints...",
          isComplete: false,
        });

        console.log(
          `🏗️ Step 3: Calling /api/design/generate-backend for project ${projId}`
        );
        const backendResponse = await axios.post(
          `${baseUrl}/api/design/generate-backend`,
          {
            projectId: projId,
          }
        );

        if (!backendResponse.data.success) {
          throw new Error(
            backendResponse.data.error || "Failed to generate backend"
          );
        }

        updateWorkflowStep("Backend Generation", {
          message: `✅ Generated backend with database schema and ${
            backendResponse.data.files
              ? Object.keys(backendResponse.data.files).length
              : 0
          } files!`,
          isComplete: true,
          data: backendResponse.data,
        });
        setWorkflowProgress(80);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Step 4: Generate frontend (streaming)
        addWorkflowStep({
          step: "Frontend Generation",
          message: "Starting frontend generation with streaming deployment...",
          isComplete: false,
        });

        console.log(
          `🎨 Step 4: Starting streaming frontend generation for project ${projId}`
        );
        await startStreamingFrontendGeneration(projId);
      } catch (error) {
        console.error("❌ Workflow failed:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Workflow failed";
        setError(errorMessage);
        setIsWorkflowActive(false);
        setProjectStatus("error");

        if (currentWorkflowStep) {
          updateWorkflowStep(currentWorkflowStep, {
            message: `❌ Failed: ${errorMessage}`,
            isComplete: true,
            error: errorMessage,
          });
        }
      } finally {
        isGenerating.current = false;
        setIsLoading(false);
      }
    },
    [
      isWorkflowActive,
      addWorkflowStep,
      updateWorkflowStep,
      currentWorkflowStep,
      baseUrl,
      supabaseConfig,
    ]
  );

  // Streaming frontend generation
  const startStreamingFrontendGeneration = useCallback(
    async (projId: number) => {
      setIsStreamingGeneration(true);
      setStreamingProgress(0);
      setStreamingPhase("initializing");
      setStreamingMessage("Starting frontend generation...");
      setStreamingStats({
        totalCharacters: 0,
        chunksReceived: 0,
        estimatedTotalChunks: 0,
        startTime: Date.now(),
      });

      try {
        console.log(
          `🎨 Starting streaming frontend generation for project ${projId}`
        );

        if (!supabaseConfig) {
          throw new Error("Supabase configuration is missing");
        }

        const response = await fetch(
          `${baseUrl}/api/design/generate-frontend`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              projectId: projId,
              supabaseUrl: supabaseConfig.supabaseUrl,
              supabaseAnonKey: supabaseConfig.supabaseAnonKey,
              supabaseToken: supabaseConfig.supabaseToken,
              databaseUrl: supabaseConfig.databaseUrl,
              userId: getCurrentUserId(),
              clerkId: clerkId,
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, message: ${errorText}`
          );
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
                handleStreamingData(data, projId);
              } catch (e) {
                console.warn("Error parsing streaming data:", e);
              }
            }
          }
        }

        console.log("✅ Streaming frontend generation completed");
      } catch (error) {
        console.error("❌ Streaming frontend generation failed:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Frontend generation failed";
        setError(errorMessage);
        setIsStreamingGeneration(false);
        setIsWorkflowActive(false);
        setProjectStatus("error");

        updateWorkflowStep("Frontend Generation", {
          message: `❌ Failed: ${errorMessage}`,
          isComplete: true,
          error: errorMessage,
        });
      }
    },
    [baseUrl, supabaseConfig, getCurrentUserId, clerkId, updateWorkflowStep]
  );

  // Handle streaming data
  const handleStreamingData = useCallback(
    (data: StreamingProgressData, projId: number) => {
      console.log(
        "📡 Frontend streaming data received:",
        data.type,
        data.message
      );

      switch (data.type) {
        case "progress":
          setStreamingProgress(data.percentage || 0);
          setStreamingPhase(data.phase || "");
          setStreamingMessage(data.message || "");

          updateWorkflowStep("Frontend Generation", {
            message: `${data.message} (${(data.percentage || 0).toFixed(0)}%)`,
            isComplete: false,
          });
          break;

        case "length":
          setStreamingStats((prev) => ({
            ...prev,
            totalCharacters: data.currentLength || 0,
            bytesPerSecond: prev.startTime
              ? (data.currentLength || 0) /
                ((Date.now() - prev.startTime) / 1000)
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
          setStreamingMessage(data.message || "Frontend generation completed!");
          setStreamingStats((prev) => ({
            ...prev,
            endTime: Date.now(),
          }));
          break;

        case "result":
          if (data.result) {
            setPreviewUrl(data.result.previewUrl);
            setProjectStatus("ready");
            setIsStreamingGeneration(false);
            setIsWorkflowActive(false);
            setWorkflowProgress(100);

            updateWorkflowStep("Frontend Generation", {
              message: `✅ Frontend deployed successfully! Files generated: ${
                data.result.files?.length || 0
              }`,
              isComplete: true,
              data: data.result,
            });

            const completionMessage: Message = {
              id: `completion-${Date.now()}`,
              content: `🎉 **Complete Application Generated Successfully!**

**📊 Generation Summary:**
- **Design Files**: Generated with Tailwind config and styling
- **File Structure**: ${
                data.result.structure?.fileCount || "Multiple"
              } files planned and organized  
- **Backend**: Database schema, migrations, and API types created
- **Frontend**: ${
                data.result.files?.length || 0
              } React components with TypeScript
- **Deployment**: Live application deployed to Azure Static Web Apps

**🚀 Your Application:**
- **Live URL**: [View Application](${data.result.previewUrl})
- **Download**: [Source Code](${data.result.downloadUrl})
- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase with migrations
- **Hosting**: Azure Static Web Apps with CDN

**✨ Features:**
- Global CDN for fast loading worldwide
- Automatic SSL/HTTPS security
- Custom domain support
- Staging environments for testing

Your application is now live and ready to use!`,
              type: "assistant",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, completionMessage]);

            if (data.result.projectId) {
              setCurrentProjectInfo({
                id: data.result.projectId,
                name: `Generated Project`,
                isVerified: true,
              });
              setCurrentProject({
                id: data.result.projectId,
                name: `Complete Application`,
                deploymentUrl: data.result.previewUrl,
                status: "ready",
              });
            }
          }
          break;

        case "error":
          setError(data.error || "Frontend generation failed");
          setIsStreamingGeneration(false);
          setIsWorkflowActive(false);
          setProjectStatus("error");

          updateWorkflowStep("Frontend Generation", {
            message: `❌ Failed: ${data.error || "Unknown error"}`,
            isComplete: true,
            error: data.error || "Unknown error",
          });
          break;
      }
    },
    [updateWorkflowStep]
  );

  // Handle modification streaming for existing projects
  const handleStreamingResponse = useCallback(
    async (currentPrompt: string) => {
      console.log("🔧 MODIFICATION ENDPOINT CALLED!");

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

        if (!response.ok) {
          throw new Error(
            `Streaming request failed with status: ${response.status}`
          );
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
              continue;
            }

            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.step && data.message) {
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
                  const completionMessage = `✅ Modification completed successfully!\n\n**Project Updated:**\n- Project ID: ${data.data.projectId}\n- Build ID: ${data.data.buildId}\n\n[View Live Preview](${data.data.previewUrl})`;

                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === streamingMessage.id
                        ? {
                            ...msg,
                            content: completionMessage,
                            isStreaming: false,
                          }
                        : msg
                    )
                  );

                  if (data.data.previewUrl) {
                    setPreviewUrl(data.data.previewUrl);
                    setProjectStatus("ready");

                    setCurrentProject((prev) =>
                      prev
                        ? {
                            ...prev,
                            deploymentUrl: data.data.previewUrl,
                            status: "ready",
                          }
                        : null
                    );
                  }
                  break;
                } else if (data.error) {
                  throw new Error(data.error);
                }
              } catch (e) {
                console.warn("Error parsing modification data:", e);
              }
            }
          }
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === streamingMessage.id
              ? { ...msg, isStreaming: false }
              : msg
          )
        );

        if (currentProject?.id) {
          await loadProject(currentProject.id);
        }
      } catch (error) {
        console.error("❌ Error in streaming response:", error);
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== streamingMessage.id)
        );

        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content:
            "Sorry, I encountered an error while processing your request.",
          type: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreamingResponse(false);
      }
    },
    [
      baseUrl,
      value,
      projectId,
      currentProjectInfo.id,
      getDeployedAppUrl,
      getCurrentUserId,
      currentProject?.id,
      clerkId,
    ]
  );

  // Server health check
  const checkServerHealth = useCallback(async () => {
    if (healthCheckDone.current) {
      return isServerHealthy;
    }

    try {
      const healthResponse = await axios.get(`${baseUrl}/health`, {
        timeout: 10000,
      });
      setIsServerHealthy(true);
      setError("");
      healthCheckDone.current = true;
      return true;
    } catch (error) {
      setIsServerHealthy(false);
      healthCheckDone.current = true;

      if (axios.isAxiosError(error)) {
        if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
          setError(
            "Backend server is not responding. Please ensure it's running on the correct port."
          );
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
  const loadProject = useCallback(
    async (projId: number) => {
      if (currentProjectId.current === projId && projectStatus !== "idle") {
        return;
      }

      console.log(`📂 Loading project ${projId}...`);
      setError("");
      setProjectStatus("fetching");
      currentProjectId.current = projId;

      try {
        const res = await axios.get<Project>(
          `${baseUrl}/api/projects/${projId}`
        );
        const project = res.data;

        console.log(`📂 Project ${projId} loaded:`, project);
        setCurrentProject(project);
        setCurrentProjectInfo({
          id: projId,
          name: project.name || `Project ${projId}`,
          isVerified: true,
        });

        if (project.deploymentUrl) {
          setPreviewUrl(project.deploymentUrl);
          setProjectStatus("ready");
        } else {
          // Project exists but no deployment URL
          setProjectStatus("idle");
        }
      } catch (error) {
        console.error(`❌ Failed to load project ${projId}:`, error);
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setError(`Project with ID ${projId} not found.`);
        } else {
          setError("Failed to load project");
        }
        setProjectStatus("error");
      }
    },
    [baseUrl, projectStatus]
  );

  // Load project messages
  const loadProjectMessages = useCallback(
    async (projectId: number) => {
      if (projectLoaded.current) {
        return;
      }

      console.log(`📨 Loading messages for project ${projectId}...`);
      try {
        const response = await axios.get(
          `${baseUrl}/api/messages/project/${projectId}`
        );

        if (response.data.success && response.data.data) {
          const history = response.data.data;
          const formattedMessages: Message[] = history.map((msg: any) => ({
            id: msg.id || Date.now().toString(),
            content: msg.content,
            type: msg.role === "user" ? "user" : "assistant",
            timestamp: new Date(msg.createdAt || msg.timestamp),
          }));

          setMessages(formattedMessages);
          console.log(
            `📨 Loaded ${formattedMessages.length} messages for project ${projectId}`
          );
        } else {
          setMessages([]);
        }
        projectLoaded.current = true;
      } catch (error) {
        console.warn(
          `⚠️ Could not load messages for project ${projectId}:`,
          error
        );
        setMessages([]);
        projectLoaded.current = true;
      }
    },
    [baseUrl]
  );

  // Save message to backend
  const saveMessage = useCallback(
    async (content: string, role: "user" | "assistant") => {
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
    },
    [baseUrl, projectId, getCurrentUserId, clerkId]
  );

  // Handle user prompt submission
  const handleSubmit = useCallback(async () => {
    if (
      !prompt.trim() ||
      isLoading ||
      isStreamingGeneration ||
      isWorkflowActive
    )
      return;

    console.log("📝 User submitted prompt:", prompt);
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
      const shouldUseModification =
        currentProject &&
        (currentProject.status === "ready" ||
          currentProject.status === "regenerating") &&
        currentProject.deploymentUrl &&
        currentProject.deploymentUrl.trim() !== "";

      console.log("🔄 Workflow decision:", {
        currentProject: currentProject?.id,
        status: currentProject?.status,
        hasDeploymentUrl: !!currentProject?.deploymentUrl,
        shouldUseModification,
        fromWorkflow,
      });

      if (shouldUseModification && !fromWorkflow) {
        console.log("🔧 Using modification workflow for existing project");
        await handleStreamingResponse(currentPrompt);
      } else {
        console.log("🚀 Using complete workflow for new/incomplete project");
        if (projectId) {
          await startCompleteWorkflow(currentPrompt, projectId);
        } else {
          throw new Error("No project ID available for workflow");
        }
      }
    } catch (error) {
      console.error("❌ Error in handleSubmit:", error);
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
    isWorkflowActive,
    projectId,
    currentProject,
    fromWorkflow,
    saveMessage,
    handleStreamingResponse,
    startCompleteWorkflow,
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

  const handlePromptChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setPrompt(e.target.value);
    },
    []
  );

  // Clear conversation
  const clearConversation = useCallback(async () => {
    if (projectId) {
      try {
        await axios.delete(`${baseUrl}/api/messages/project/${projectId}`);
        setMessages([]);
        setWorkflowSteps([]);
        setIsWorkflowActive(false);
        setWorkflowProgress(0);
      } catch (error) {
        setError("Failed to clear conversation");
      }
    } else {
      setMessages([]);
      setWorkflowSteps([]);
      setIsWorkflowActive(false);
      setWorkflowProgress(0);
    }
  }, [baseUrl, projectId]);

  // Retry connection
  const retryConnection = useCallback(async () => {
    setIsRetrying(true);
    setError("");
    setProjectStatus("loading");

    healthCheckDone.current = false;
    projectLoaded.current = false;
    hasInitialized.current = false;

    try {
      const isHealthy = await checkServerHealth();
      if (isHealthy) {
        if (existingProject && projectId) {
          await loadProject(projectId);
          await loadProjectMessages(projectId);
        } else if (fromWorkflow && navPrompt && projectId) {
          setPrompt(navPrompt);
          await startCompleteWorkflow(navPrompt, projectId);
        } else {
          setProjectStatus("idle");
        }
        hasInitialized.current = true;
      }
    } catch (error) {
      setError(
        "Still cannot connect to server. Please check your backend setup."
      );
      setProjectStatus("error");
    } finally {
      setIsRetrying(false);
    }
  }, [
    checkServerHealth,
    existingProject,
    projectId,
    fromWorkflow,
    navPrompt,
    loadProject,
    loadProjectMessages,
    startCompleteWorkflow,
  ]);

  // Stop workflow/generation
  const stopWorkflow = useCallback(() => {
    setIsWorkflowActive(false);
    setIsStreamingGeneration(false);
    isGenerating.current = false;
    setStreamingPhase("stopped");
    setStreamingMessage("Process stopped by user");

    if (currentWorkflowStep) {
      updateWorkflowStep(currentWorkflowStep, {
        message: "⏹️ Process stopped by user",
        isComplete: true,
      });
    }
  }, [currentWorkflowStep, updateWorkflowStep]);

  // Format streaming duration
  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  }, []);

  // Format bytes per second
  const formatSpeed = useCallback((bytesPerSecond: number) => {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024)
      return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }, []);

  // SINGLE UNIFIED INITIALIZATION
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    const initialize = async () => {
      console.log("🚀 ChatPage initialization started");
      console.log("📋 Navigation state:", {
        projectId,
        existingProject,
        fromWorkflow,
        navPrompt: navPrompt ? `"${navPrompt.substring(0, 50)}..."` : null,
        supabaseConfigExists: !!supabaseConfig,
      });

      // Set navigating state for smooth transitions
      if (fromWorkflow || navPrompt) {
        setIsNavigating(true);
      }

      // Health check first
      const serverHealthy = await checkServerHealth();
      if (!serverHealthy) {
        setProjectStatus("error");
        setIsNavigating(false);
        return;
      }

      try {
        // Determine what to do based on the navigation state
        if (fromWorkflow && navPrompt && projectId) {
          console.log("🎨 WORKFLOW FROM INDEX: Starting complete workflow");
          // Add the user message first
          const userMessage: Message = {
            id: `user-${Date.now()}`,
            content: navPrompt,
            type: "user",
            timestamp: new Date(),
          };
          setMessages([userMessage]);

          // Load project first, then start workflow
          await loadProject(projectId);
          await startCompleteWorkflow(navPrompt, projectId);
        } else if (existingProject && projectId) {
          console.log("📂 EXISTING PROJECT: Loading project and messages");
          await loadProject(projectId);
          await loadProjectMessages(projectId);
        } else if (projectId) {
          console.log("🔍 PROJECT ID ONLY: Loading project details");
          await loadProject(projectId);
          await loadProjectMessages(projectId);
        } else {
          console.log("⭐ NO PROJECT: Ready for user input");
          setProjectStatus("idle");
        }
      } catch (error) {
        console.error("❌ Initialization error:", error);
        setError("Failed to initialize project");
        setProjectStatus("error");
      } finally {
        setIsNavigating(false);
      }

      console.log("✅ ChatPage initialization complete");
    };

    initialize();
  }, [
    checkServerHealth,
    loadProject,
    loadProjectMessages,
    startCompleteWorkflow,
    existingProject,
    projectId,
    fromWorkflow,
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
              {(isStreamingGeneration || isWorkflowActive) && (
                <button
                  onClick={stopWorkflow}
                  className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                  title="Stop process"
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

        {/* Workflow Progress Section */}
        {isWorkflowActive && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border-b border-blue-500/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <img
                  src="/main.png"
                  alt="CodePup Logo"
                  className="w-8 h-8 md:w-8 md:h-8 object-contain"
                />
                <span className="text-xs font-medium text-blue-400">
                  WORKFLOW GENERATION
                </span>
                <button
                  onClick={() => setShowStreamingDetails(!showStreamingDetails)}
                  className="text-xs text-slate-400 hover:text-slate-300"
                >
                  {showStreamingDetails ? "−" : "+"}
                </button>
              </div>
              <span className="text-xs text-blue-300">{workflowProgress}%</span>
            </div>

            {/* Overall Progress Bar */}
            <div className="w-full bg-slate-800/50 rounded-full h-2 mb-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${workflowProgress}%` }}
              ></div>
            </div>

            {/* Current Step */}
            <div className="space-y-1 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-purple-400">
                  {currentWorkflowStep || "Initializing"}
                </span>
                {isWorkflowActive && (
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
            </div>

            {/* Workflow Steps */}
            <div className="space-y-2">
              {[
                { name: "Design Generation", icon: Palette },
                { name: "Structure Planning", icon: FileText },
                { name: "Backend Generation", icon: Database },
                { name: "Frontend Generation", icon: Monitor },
              ].map((step, index) => {
                const stepData = workflowSteps.find(
                  (s) => s.step === step.name
                );
                const isActive = currentWorkflowStep === step.name;
                const isComplete = stepData?.isComplete;
                const hasError = stepData?.error;

                return (
                  <div
                    key={step.name}
                    className={`flex items-center gap-2 text-xs p-2 rounded ${
                      hasError
                        ? "bg-red-500/20 text-red-300"
                        : isComplete
                        ? "bg-green-500/20 text-green-300"
                        : isActive
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-slate-700/30 text-slate-400"
                    }`}
                  >
                    <step.icon className="w-3 h-3" />
                    <span className="flex-1">{step.name}</span>
                    {hasError ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : isComplete ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : isActive ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Frontend Streaming Progress */}
            {isStreamingGeneration && (
              <div className="mt-3 p-2 bg-slate-800/30 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-blue-400 font-medium capitalize">
                    {streamingPhase}
                  </span>
                  <span className="text-xs text-blue-300">
                    {streamingProgress.toFixed(0)}%
                  </span>
                </div>

                <div className="w-full bg-slate-700/50 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-gradient-to-r from-blue-400 to-purple-400 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${streamingProgress}%` }}
                  ></div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">
                  {streamingMessage}
                </p>

                {/* Streaming Stats */}
                {streamingStats.totalCharacters > 0 && showStreamingDetails && (
                  <div className="mt-2 text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>
                        {streamingStats.totalCharacters.toLocaleString()} chars
                      </span>
                      <span>
                        {streamingStats.chunksReceived}/
                        {streamingStats.estimatedTotalChunks || "?"} chunks
                      </span>
                    </div>
                    {streamingStats.bytesPerSecond &&
                      streamingStats.bytesPerSecond > 0 && (
                        <div className="flex justify-between">
                          <span>
                            Speed: {formatSpeed(streamingStats.bytesPerSecond)}
                          </span>
                          <span>
                            Duration:{" "}
                            {formatDuration(
                              Date.now() - streamingStats.startTime
                            )}
                          </span>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* User Info Display */}
        {(passedUserId || clerkId) && (
          <div className="bg-slate-800/30 border-b border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs font-medium text-blue-400">
                USER SESSION
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              {passedUserId && <div>User ID: {passedUserId}</div>}
              {clerkId && <div>Clerk ID: {clerkId.substring(0, 8)}...</div>}
            </div>
          </div>
        )}

        {/* Project Info */}
        {currentProject && (
          <div className="bg-slate-800/30 border-b border-slate-700/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">
                PROJECT
              </span>
              {currentProjectInfo.isVerified && (
                <div
                  className="w-2 h-2 rounded-full bg-green-500"
                  title="Project verified"
                ></div>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white font-medium">
                {currentProject.name || `Project ${currentProject.id}`}
              </p>
              {currentProject.description && (
                <p className="text-xs text-slate-300 line-clamp-2">
                  {currentProject.description}
                </p>
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
              <span className="text-xs font-medium text-red-400">
                SERVER OFFLINE
              </span>
            </div>
            <p className="text-xs text-red-300">
              Cannot connect to backend server
            </p>
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

          {messages.length === 0 &&
          (projectStatus === "loading" ||
            projectStatus === "fetching" ||
            isWorkflowActive ||
            isNavigating) ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4">
                {isWorkflowActive ? (
                  <img
                    src="/main.png"
                    alt="CodePup Logo"
                    className="w-16 h-16 md:w-8 md:h-8 object-contain"
                  />
                ) : (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                )}
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                {isNavigating
                  ? "Preparing Workspace"
                  : isWorkflowActive
                  ? "Complete Application Generation"
                  : projectStatus === "fetching"
                  ? "Fetching Project"
                  : existingProject
                  ? "Loading Project"
                  : "Generating Code"}
              </h3>
              <p className="text-slate-400 max-w-sm text-sm">
                {isNavigating
                  ? "Setting up your project workspace..."
                  : isWorkflowActive
                  ? `${currentWorkflowStep} • ${workflowProgress}% complete`
                  : projectStatus === "fetching"
                  ? "Fetching project details and deployment status..."
                  : existingProject
                  ? "Loading your project preview..."
                  : "We are generating code files please wait"}
              </p>
              {currentProject && (
                <div className="mt-3 text-xs text-slate-500">
                  Project ID: {currentProject.id} • Status:{" "}
                  {currentProject.status}
                </div>
              )}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="p-4 bg-slate-800/30 rounded-full mb-4">
                <Code className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Ready to Chat
              </h3>
              <p className="text-slate-400 max-w-sm text-sm">
                {currentProject && currentProject.status === "ready"
                  ? "Your project is ready! Start describing changes you'd like to make."
                  : fromWorkflow
                  ? "Complete application generation will start when you submit a prompt..."
                  : "Start describing your project or changes you'd like to make"}
              </p>
              {currentProject && (
                <div className="mt-3 text-xs text-slate-500">
                  Project: {currentProject.name || currentProject.id}
                </div>
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
                      message.type === "user"
                        ? "bg-blue-600/20 ml-4"
                        : "bg-slate-800/30 mr-4"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.workflowStep && (
                        <div className="mt-1">
                          {message.workflowStep === "Design Generation" && (
                            <Palette className="w-3 h-3 text-blue-400" />
                          )}
                          {message.workflowStep === "Structure Planning" && (
                            <FileText className="w-3 h-3 text-green-400" />
                          )}
                          {message.workflowStep === "Backend Generation" && (
                            <Database className="w-3 h-3 text-purple-400" />
                          )}
                          {message.workflowStep === "Frontend Generation" && (
                            <Monitor className="w-3 h-3 text-orange-400" />
                          )}
                        </div>
                      )}
                      <p className="text-white text-sm flex-1 whitespace-pre-wrap">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
                        )}
                      </p>
                      {message.isStreaming && (
                        <Loader2 className="w-3 h-3 text-slate-400 animate-spin mt-0.5" />
                      )}
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
                  : isWorkflowActive || isStreamingGeneration
                  ? "Workflow in progress..."
                  : "Describe your project or changes..."
              }
              rows={2}
              disabled={
                isLoading ||
                projectStatus === "loading" ||
                projectStatus === "fetching" ||
                isStreamingResponse ||
                isStreamingGeneration ||
                isWorkflowActive ||
                isNavigating ||
                isServerHealthy === false
              }
              maxLength={1000}
            />
            <button
              onClick={handleSubmit}
              disabled={
                isLoading ||
                projectStatus === "loading" ||
                projectStatus === "fetching" ||
                isStreamingResponse ||
                isStreamingGeneration ||
                isWorkflowActive ||
                isNavigating ||
                isServerHealthy === false
              }
              className="absolute bottom-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded-lg transition-colors duration-200"
            >
              {isLoading ||
              isStreamingResponse ||
              isStreamingGeneration ||
              isWorkflowActive ? (
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
                : isWorkflowActive || isStreamingGeneration
                ? "Complete workflow in progress..."
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
              {/* Workflow Status Indicator */}
              {isWorkflowActive && (
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
                  <span className="text-blue-400">
                    {isStreamingGeneration
                      ? `Streaming ${streamingPhase}`
                      : `Workflow ${currentWorkflowStep}`}
                  </span>
                  <span className="text-slate-400">
                    {isStreamingGeneration
                      ? `${streamingProgress.toFixed(0)}%`
                      : `${workflowProgress}%`}
                  </span>
                </div>
              )}
              {(projectId || currentProjectInfo.id) && (
                <span className="text-xs text-slate-400">
                  Project: {projectId || currentProjectInfo.id}
                </span>
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
                      : isWorkflowActive || isStreamingGeneration
                      ? "bg-blue-500 animate-pulse"
                      : projectStatus === "ready"
                      ? "bg-green-500"
                      : projectStatus === "loading" ||
                        projectStatus === "fetching"
                      ? "bg-yellow-500"
                      : projectStatus === "error"
                      ? "bg-red-500"
                      : "bg-gray-500"
                  }`}
                ></div>
                <span className="text-xs text-slate-400 capitalize">
                  {isServerHealthy === false
                    ? "offline"
                    : isWorkflowActive
                    ? "workflow"
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
            {previewUrl &&
            isServerHealthy !== false &&
            !isWorkflowActive &&
            !isStreamingGeneration ? (
              <iframe
                src={previewUrl}
                className="w-full h-full"
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                onError={(e) => {
                  console.error("Iframe load error:", e);
                  setError(
                    "Failed to load preview. The deployment might not be ready yet."
                  );
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-slate-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
                    {isServerHealthy === false ? (
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    ) : isWorkflowActive || isStreamingGeneration ? (
                      <img
                        src="/main.png"
                        alt="CodePup Logo"
                        className="w-16 h-16 md:w-8 md:h-8 object-contain"
                      />
                    ) : isGenerating.current ||
                      projectStatus === "loading" ||
                      projectStatus === "fetching" ? (
                      <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    ) : (
                      <Code className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <p className="text-slate-600 mb-4">
                    {isServerHealthy === false
                      ? "Server is offline - cannot load preview"
                      : isWorkflowActive
                      ? `Complete workflow in progress: ${currentWorkflowStep} (${workflowProgress}%)`
                      : isStreamingGeneration
                      ? `Frontend generation: ${streamingPhase} (${streamingProgress.toFixed(
                          0
                        )}%)`
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
                      : fromWorkflow
                      ? "Complete application workflow will start when you submit a prompt..."
                      : "Preview will appear here"}
                  </p>

                  {/* Workflow Progress Details in Preview */}
                  {isWorkflowActive && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${workflowProgress}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>
                          Current Step:{" "}
                          <span className="font-medium text-blue-600">
                            {currentWorkflowStep}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          Progress:{" "}
                          <span className="font-medium">
                            {workflowProgress}%
                          </span>{" "}
                          complete
                        </div>
                      </div>

                      {/* Mini workflow steps */}
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {[
                          { name: "Design", icon: Palette },
                          { name: "Structure", icon: FileText },
                          { name: "Backend", icon: Database },
                          { name: "Frontend", icon: Monitor },
                        ].map((step, index) => {
                          const stepData = workflowSteps.find((s) =>
                            s.step.includes(step.name)
                          );
                          const isActive = currentWorkflowStep.includes(
                            step.name
                          );
                          const isComplete = stepData?.isComplete;
                          const hasError = stepData?.error;

                          return (
                            <div
                              key={step.name}
                              className={`flex items-center gap-1 p-2 rounded ${
                                hasError
                                  ? "bg-red-100 text-red-600"
                                  : isComplete
                                  ? "bg-green-100 text-green-600"
                                  : isActive
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-gray-100 text-gray-400"
                              }`}
                            >
                              <step.icon className="w-3 h-3" />
                              <span>{step.name}</span>
                              {hasError ? (
                                <AlertCircle className="w-2 h-2 ml-auto" />
                              ) : isComplete ? (
                                <CheckCircle className="w-2 h-2 ml-auto" />
                              ) : isActive ? (
                                <Loader2 className="w-2 h-2 ml-auto animate-spin" />
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Frontend Streaming Progress Details in Preview */}
                  {isStreamingGeneration && (
                    <div className="mb-4">
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                        <div
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${streamingProgress}%` }}
                        ></div>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>
                          Phase:{" "}
                          <span className="font-medium text-green-600 capitalize">
                            {streamingPhase}
                          </span>
                        </div>
                        {streamingStats.totalCharacters > 0 && (
                          <div>
                            Generated:{" "}
                            <span className="font-medium">
                              {streamingStats.totalCharacters.toLocaleString()}
                            </span>{" "}
                            characters
                          </div>
                        )}
                        {streamingStats.chunksReceived > 0 && (
                          <div>
                            Chunks:{" "}
                            <span className="font-medium">
                              {streamingStats.chunksReceived}
                            </span>{" "}
                            received
                          </div>
                        )}
                        {streamingStats.bytesPerSecond &&
                          streamingStats.bytesPerSecond > 0 && (
                            <div>
                              Speed:{" "}
                              <span className="font-medium">
                                {formatSpeed(streamingStats.bytesPerSecond)}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {currentProject &&
                    currentProject.status &&
                    currentProject.status !== "ready" &&
                    !isWorkflowActive &&
                    !isStreamingGeneration && (
                      <div className="text-xs text-slate-500 mb-4">
                        Project Status: {currentProject.status}
                        {currentProject.status === "building" && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full animate-pulse"
                                style={{ width: "60%" }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  {(isServerHealthy === false || projectStatus === "error") &&
                    !isWorkflowActive &&
                    !isStreamingGeneration && (
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

                  {/* Stop workflow button in preview */}
                  {(isWorkflowActive || isStreamingGeneration) && (
                    <button
                      onClick={stopWorkflow}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm ml-2"
                    >
                      <Activity className="w-4 h-4 inline mr-2" />
                      Stop Process
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
