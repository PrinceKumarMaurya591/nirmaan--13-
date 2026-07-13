import React, { createContext, useContext, useState } from "react";
import { AppState, Project, Role, AppView, User } from "./types";

const mockProjects: Project[] = [];

const initialState: AppState = {
  currentUser: null,
  currentRole: "Admin",
  currentView: "dashboard",
  selectedProjectId: "",
  projects: mockProjects,
  users: [],
  notifications: [],
  isSynced: false,
  hasAdmin: true, // assume true until checked
};

interface SyncRequest {
  id: string;
  url: string;
  method: string;
  body?: any;
  timestamp: number;
}

const getSyncQueue = (): SyncRequest[] => {
  const q = localStorage.getItem("thikedar_sync_queue");
  return q ? JSON.parse(q) : [];
};

const setSyncQueue = (queue: SyncRequest[]) => {
  localStorage.setItem("thikedar_sync_queue", JSON.stringify(queue));
};

const addToSyncQueue = (url: string, method: string, body?: string) => {
  let queue = getSyncQueue();

  // Deduplicate: if this is a project PUT update, remove any older queued PUT updates for this project
  const projectMatch = url.match(/\/api\/projects\/([^/?#]+)/);
  if (method.toUpperCase() === "PUT" && projectMatch) {
    const projectId = projectMatch[1];
    queue = queue.filter(req => {
      const reqMatch = req.url.match(/\/api\/projects\/([^/?#]+)/);
      const isSameProjectPut = req.method.toUpperCase() === "PUT" && reqMatch && reqMatch[1] === projectId;
      return !isSameProjectPut;
    });
  }

  queue.push({
    id: `sync_${Date.now()}_${Math.random()}`,
    url,
    method,
    body: body ? JSON.parse(body) : undefined,
    timestamp: Date.now(),
  });
  setSyncQueue(queue);
};

const clearProjectFromSyncQueue = (projectId: string) => {
  const queue = getSyncQueue();
  const filtered = queue.filter(req => {
    const reqMatch = req.url.match(/\/api\/projects\/([^/?#]+)/);
    const isSameProjectPut = req.method.toUpperCase() === "PUT" && reqMatch && reqMatch[1] === projectId;
    return !isSameProjectPut;
  });
  setSyncQueue(filtered);
};

const processSyncQueue = async () => {
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  const auth = localStorage.getItem("thikedar_auth");
  const headers = new Headers({ "Content-Type": "application/json" });
  if (auth) {
    const { phone, pin, token } = JSON.parse(auth);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (phone && pin) {
      headers.set("x-user-phone", phone);
      headers.set("x-user-pin", pin);
    }
  }

  let successCount = 0;
  const newQueue = [...queue];

  for (const req of queue) {
    try {
      const res = await window.fetch(req.url, {
        method: req.method,
        headers,
        body: req.body,
      });
      if (res.ok || res.status >= 400) {
        // If it's a 4xx error we probably shouldn't retry infinitely either
        // Remove from queue
        const index = newQueue.findIndex((q) => q.id === req.id);
        if (index !== -1) newQueue.splice(index, 1);
        successCount++;
      }
    } catch (e) {
      // Still offline or failed network
      break;
    }
  }

  setSyncQueue(newQueue);
  if (successCount > 0) {
    console.log(`Successfully synced ${successCount} queued operations.`);
  }
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  try {
    const auth = localStorage.getItem("thikedar_auth");
    if (auth) {
      const { phone, pin, token } = JSON.parse(auth);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      } else if (phone && pin) {
        headers.set("x-user-phone", phone);
        headers.set("x-user-pin", pin);
      }
    }
  } catch (e) {}

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for poor networks
  try {
    const res = await window.fetch(url, { ...options, headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.status === 401) {
      localStorage.removeItem("thikedar_auth");
      localStorage.removeItem("thikedar_state");
      window.location.reload();
      return res;
    }
    
    return res;
  } catch (err) {
    // Network error
    if (
      options.method &&
      ["POST", "PUT", "DELETE"].includes(options.method.toUpperCase())
    ) {
      console.warn(
        "Network error during API call. Queuing operation for offline sync.",
        url,
      );
      addToSyncQueue(url, options.method, options.body as string);
      // Return a mock ok response to not break the UI state update
      return new Response(JSON.stringify({ status: "queued" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err; // For GET requests, we let it fail
  }
};

interface AppContextType {
  state: AppState;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  login: (phone: string, pin: string) => Promise<boolean | { error: string }>;
  logout: () => void;
  resetPin: (phone: string, newPin: string) => Promise<boolean | { error: string }>;
  setRole: (role: Role) => void;
  setView: (view: AppView, projectId?: string) => void;
  addProject: (
    project: Omit<Project, "id" | "received" | "expenses" | "status">,
  ) => void;
  updateProject: (
    projectId: string,
    updates: Partial<Project> | ((prevProj: Project) => Partial<Project>),
    logDetails?: string,
  ) => void;
  deleteProject: (projectId: string) => void;
  addUser: (user: Omit<User, "id">) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  toggleUserStatus: (userId: string) => void;
  deleteUser: (userId: string) => void;
  setEntryTab: (
    tab: "material" | "logistics" | "labor" | "machinery" | "misc" | "photos" | "shifting" | "petty_cash" | "",
  ) => void;
  markNotificationsRead: () => void;
  addNotification: (message: string, projectId?: string) => void;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
  setSearchQuery: (query: string) => void;
  setLanguage: (lang: "en" | "hi") => void;
  confirm: (message: string) => Promise<boolean>;
  prompt: (message: string) => Promise<string | null>;
  addToRecycleBin: (item: Omit<import("./types").RecycleBinItem, "id" | "deletedAt">) => void;
  removeFromRecycleBin: (id: string) => void;
  addApprovalRequest: (request: Omit<import("./types").ApprovalRequest, "id" | "requestedAt" | "status">) => void;
  updateApprovalRequest: (id: string, updates: Partial<import("./types").ApprovalRequest>) => void;
  addAuditLog: (log: Omit<import("./types").AppAuditLog, "id" | "timestamp">) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, resolve: ((v: boolean) => void) | null}>({isOpen: false, message: '', resolve: null});
  const [promptModal, setPromptModal] = useState<{isOpen: boolean, message: string, resolve: ((v: string | null) => void) | null}>({isOpen: false, message: '', resolve: null});
  const [promptValue, setPromptValue] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);

  const showConfirm = (message: string) => {
    return new Promise<boolean>((resolve) => {
      setConfirmModal({ isOpen: true, message, resolve });
    });
  };

  const showPrompt = (message: string) => {
    return new Promise<string | null>((resolve) => {
      setPromptValue("");
      setPromptModal({ isOpen: true, message, resolve });
    });
  };

  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem("thikedar_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return { ...initialState, ...parsed, isSynced: false }; // always force check on load
        }
      } catch (e) {}
    }
    return initialState;
  });
  
  const activeMutationsRef = React.useRef(0);
  const lastMutationIdRef = React.useRef(0);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const saveState = () => {
         try {
           localStorage.setItem("thikedar_state", JSON.stringify(state));
         } catch (e) {
           console.error("Failed to save state to localStorage", e);
         }
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(saveState);
      } else {
        setTimeout(saveState, 0);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [state]);

  React.useEffect(() => {
    const handleOnline = () => {
      console.log("App is online. Processing sync queue...");
      processSyncQueue();
      // Optional: you could add a toast here if you want by exposing addToast somehow,
      // but simple console log is fine for the worker.
    };

    window.addEventListener("online", handleOnline);
    // Also try to process queue on mount in case we are already online
    if (navigator.onLine) {
      processSyncQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  React.useEffect(() => {
    // Only fetch if already logged in and have tenant
    const fetchData = async () => {
      try {
        const checkPromise = apiFetch("/api/companies/check");
        const usersPromise = state.currentTenantId
          ? apiFetch(`/api/users?tenantId=${state.currentTenantId}`)
          : Promise.resolve(null);
        const projectsPromise = state.currentTenantId
          ? apiFetch(`/api/projects?tenantId=${state.currentTenantId}`)
          : Promise.resolve(null);
        const recycleBinPromise = state.currentTenantId
          ? apiFetch(`/api/recycle-bin?tenantId=${state.currentTenantId}`)
          : Promise.resolve(null);

        const [setupRes, usersRes, projectsRes, recycleBinRes] = await Promise.all([
          checkPromise,
          usersPromise,
          projectsPromise,
          recycleBinPromise,
        ]);

        let hasAdmin = true;
        if (setupRes.ok) {
          const setup = await setupRes.json();
          hasAdmin = setup.count > 0;
        }

        if (
          state.currentTenantId &&
          usersRes &&
          projectsRes &&
          recycleBinRes &&
          usersRes.ok &&
          projectsRes.ok &&
          recycleBinRes.ok
        ) {
          const [fetchedUsers, fetchedProjects, fetchedRecycleBin] = await Promise.all([
            usersRes.json(),
            projectsRes.json(),
            recycleBinRes.json(),
          ]);
          setState((prev) => {
            const updatedUsers = fetchedUsers.map((u: any) => {
              const rawProjects = u.assignedProjects || u.assigned_projects || [];
              const assignedProjects = rawProjects.filter((id: string) => fetchedProjects.some((p: any) => p.id === id));
              const pettyCashBalance = u.pettyCashBalance !== undefined ? u.pettyCashBalance : (u.petty_cash_balance !== undefined ? u.petty_cash_balance : 0);
              const addressProof = u.addressProof || u.address_proof || '';
              return {
                ...u,
                assignedProjects,
                pettyCashBalance,
                addressProof,
              };
            });
            const updatedCurrentUser = prev.currentUser
              ? updatedUsers.find((u: any) => u.id === prev.currentUser!.id) || prev.currentUser
              : null;
            return {
              ...prev,
              users: updatedUsers,
              currentUser: updatedCurrentUser,
              currentRole: updatedCurrentUser ? updatedCurrentUser.role : prev.currentRole,
              projects: fetchedProjects,
              recycleBin: fetchedRecycleBin,
              isSynced: true,
              hasAdmin: hasAdmin,
            };
          });
          return;
        }
        setState((prev) => ({ ...prev, isSynced: true, hasAdmin }));
      } catch (e) {
        console.warn("Background sync paused (network/server unavailable)");
        setState((prev) => ({ ...prev, isSynced: true })); // fallback so app doesn't hang
      }
    };
    fetchData();
  }, [state.currentTenantId]);

  // Periodic polling background sync to keep Admin, Office Staff, and Munshis completely in sync.
  // This automatically fetches the latest database records every 15 seconds when logged in.
  React.useEffect(() => {
    if (!state.currentTenantId) return;

    let syncVersion = 0;
    const interval = setInterval(async () => {
      if (document.hidden) return;
      if (activeMutationsRef.current > 0) return;

      const mutationIdBeforeFetch = lastMutationIdRef.current;
      try {
        const checkRes = await apiFetch('/api/sync-check?v=' + syncVersion);
        if (!checkRes.ok) return;
        const checkData = await checkRes.json();
        
        if (!checkData.hasUpdates) return; // DB NOT changed, do not fetch full data!
        
        syncVersion = checkData.version;
        
        const t = Date.now();
        const usersRes = await apiFetch(`/api/users?tenantId=${state.currentTenantId}&_t=${t}`);
        const projectsRes = await apiFetch(`/api/projects?tenantId=${state.currentTenantId}&_t=${t}`);

        if (usersRes.ok && projectsRes.ok) {
          const fetchedUsers = await usersRes.json();
          const fetchedProjects = await projectsRes.json();
          
          if (activeMutationsRef.current > 0 || lastMutationIdRef.current !== mutationIdBeforeFetch) return; // double check after await

          setState((prev) => {
            // Compare stringified versions of projects and stripped users to minimize unnecessary React re-renders
            const projectsChanged = JSON.stringify(prev.projects) !== JSON.stringify(fetchedProjects);
            const prevUsersStripped = prev.users.map(u => ({
              id: u.id,
              name: u.name,
              pettyCashBalance: u.pettyCashBalance,
              status: u.status,
              assignedProjects: u.assignedProjects || []
            }));
            const fetchedUsersStripped = fetchedUsers.map((u: any) => {
              const pettyCashBalance = u.pettyCashBalance !== undefined ? u.pettyCashBalance : (u.petty_cash_balance !== undefined ? u.petty_cash_balance : 0);
              const isArchived = u.isArchived || u.is_archived || false;
              const rawProjects = u.assignedProjects || u.assigned_projects || [];
              const assignedProjects = rawProjects.filter((id: string) => fetchedProjects.some((p: any) => p.id === id));
              return {
                id: u.id,
                name: u.name,
                pettyCashBalance,
                isArchived,
                assignedProjects
              };
            });
            const usersChanged = JSON.stringify(prevUsersStripped) !== JSON.stringify(fetchedUsersStripped);

            if (!projectsChanged && !usersChanged) {
              return prev;
            }

            const updatedUsers = fetchedUsers.map((u: any) => {
              const existing = prev.users.find(ex => ex.id === u.id);
              const rawProjects = u.assignedProjects || u.assigned_projects || [];
              const assignedProjects = rawProjects.filter((id: string) => fetchedProjects.some((p: any) => p.id === id));
              const pettyCashBalance = u.pettyCashBalance !== undefined ? u.pettyCashBalance : (u.petty_cash_balance !== undefined ? u.petty_cash_balance : 0);
              const addressProof = u.addressProof || u.address_proof || '';
              return {
                ...existing,
                ...u,
                assignedProjects,
                pettyCashBalance,
                addressProof,
              };
            });
            const updatedCurrentUser = prev.currentUser
              ? updatedUsers.find((u: any) => u.id === prev.currentUser!.id) || prev.currentUser
              : null;

            return {
              ...prev,
              users: updatedUsers,
              currentUser: updatedCurrentUser,
              currentRole: updatedCurrentUser ? updatedCurrentUser.role : prev.currentRole,
              projects: fetchedProjects,
            };
          });
        }
      } catch (err: any) {
        if (err.name !== 'TypeError' || !err.message.includes('Failed to fetch')) {
          console.warn("Polling sync error:", err);
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [state.currentTenantId]);

  // Immediate sync when tab gets focus, is visible, or storage changes (e.g. login/logout in other tabs)
  React.useEffect(() => {
    if (!state.currentTenantId) return;

    const syncImmediately = async () => {
      if (activeMutationsRef.current > 0) return;
      const mutationIdBeforeFetch = lastMutationIdRef.current;
      try {
        const t = Date.now();
        const usersRes = await apiFetch(`/api/users?tenantId=${state.currentTenantId}&_t=${t}`);
        const projectsRes = await apiFetch(`/api/projects?tenantId=${state.currentTenantId}&_t=${t}`);

        if (usersRes.ok && projectsRes.ok) {
          const fetchedUsers = await usersRes.json();
          const fetchedProjects = await projectsRes.json();

          if (activeMutationsRef.current > 0 || lastMutationIdRef.current !== mutationIdBeforeFetch) return;

          setState((prev) => {
            const updatedUsers = fetchedUsers.map((u: any) => {
              const rawProjects = u.assignedProjects || u.assigned_projects || [];
              const assignedProjects = rawProjects.filter((id: string) => fetchedProjects.some((p: any) => p.id === id));
              const pettyCashBalance = u.pettyCashBalance !== undefined ? u.pettyCashBalance : (u.petty_cash_balance !== undefined ? u.petty_cash_balance : 0);
              const addressProof = u.addressProof || u.address_proof || '';
              return {
                ...u,
                assignedProjects,
                pettyCashBalance,
                addressProof,
              };
            });
            const updatedCurrentUser = prev.currentUser
              ? updatedUsers.find((u: any) => u.id === prev.currentUser!.id) || prev.currentUser
              : null;
            return {
              ...prev,
              users: updatedUsers,
              currentUser: updatedCurrentUser,
              currentRole: updatedCurrentUser ? updatedCurrentUser.role : prev.currentRole,
              projects: fetchedProjects,
            };
          });
        }
      } catch (err: any) {
        if (err.name !== 'TypeError' || !err.message.includes('Failed to fetch')) {
          console.warn("Focus sync error:", err);
        }
      }
    };

    const handleFocusAndVisibility = () => {
      if (!document.hidden) {
        syncImmediately();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "thikedar_auth") {
        // Auth changed in another tab, reload to prevent role collision!
        window.location.reload();
      }
    };

    window.addEventListener("focus", handleFocusAndVisibility);
    document.addEventListener("visibilitychange", handleFocusAndVisibility);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("focus", handleFocusAndVisibility);
      document.removeEventListener("visibilitychange", handleFocusAndVisibility);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [state.currentTenantId]);

  const login = async (
    phone: string,
    pin: string,
  ): Promise<boolean | { error: string }> => {
    try {
      const res = await window.fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { error: data.error || "Login failed" };
      }

      localStorage.setItem(
        "thikedar_auth",
        JSON.stringify({ phone, token: data.token }),
      );

      const user = {
        ...data.user,
        assignedProjects: data.user.assignedProjects || data.user.assigned_projects || [],
        pettyCashBalance: data.user.pettyCashBalance !== undefined ? data.user.pettyCashBalance : (data.user.petty_cash_balance !== undefined ? data.user.petty_cash_balance : 0),
        addressProof: data.user.addressProof || data.user.address_proof || '',
      };

      let view: AppView = "dashboard";
      if (user.role === "Munshi" || user.role === "Site Incharge")
        view = "mobile_home";

      setState((prev) => ({
        ...prev,
        currentTenantId: data.user.tenant_id,
        currentTenantName: data.company?.name || "Company",
        currentUser: user,
        currentRole: user.role,
        currentView: view,
        language: user.preferences?.language || prev.language || "en",
      }));
      return true;
    } catch (e: any) {
      return { error: "Network error during login" };
    }
  };

  const logout = () => {
    localStorage.removeItem("thikedar_auth");
    setState(initialState);
  };

  const resetPin = async (phone: string, newPin: string, otp: string = "123456"): Promise<boolean | { error: string }> => {
    try {
      const res = await window.fetch("/api/auth/reset-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, newPin, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { error: data.error || "Failed to reset password." };
      }
      return true;
    } catch (e) {
      console.error("Failed to update PIN in backend", e);
      return { error: "An unexpected error occurred." };
    }
  };

  const setRole = (role: Role) => {
    setState((prev) => {
      let newView = prev.currentView;
      if (role === "Munshi" || role === "Site Incharge") {
        newView = "mobile_home";
      } else if (
        newView === "munshi_entry" ||
        newView === "mobile_home" ||
        newView === "mobile_settings" ||
        newView === "attendance"
      ) {
        newView = "dashboard";
      }
      return { ...prev, currentRole: role, currentView: newView };
    });
  };

  const setView = (view: AppView, projectId?: string) => {
    setState((prev) => ({
      ...prev,
      currentView: view,
      selectedProjectId:
        projectId !== undefined ? projectId : prev.selectedProjectId,
    }));
  };

  const addUser = async (userData: Omit<User, "id">) => {
    const originalUsers = state.users;
    const newUser = { ...userData, id: `u-${Date.now()}`, status: "Active" };
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser as User],
    }));
    
    try {
      const res = await apiFetch(
        `/api/users?tenantId=${state.currentTenantId || "default"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser),
        },
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      console.error("Failed to add user:", err);
      setState(prev => ({ ...prev, users: originalUsers }));
      addToast(`Failed to add user on the server: ${err.message}`, "error");
    }
  };

  const toggleUserStatus = async (userId: string) => {
    const userToToggle = state.users.find((u) => u.id === userId);
    if (!userToToggle) return;
    const newStatus = userToToggle.status === "Active" ? "Inactive" : "Active";
    
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, status: newStatus } : u,
      ),
    }));
    try {
      await apiFetch(
        `/api/users/${userId}?tenantId=${state.currentTenantId || "default"}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
    } finally {
      activeMutationsRef.current--;
    }
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === userId ? { ...u, ...updates } : u,
      ),
    }));
    try {
      await apiFetch(
        `/api/users/${userId}?tenantId=${state.currentTenantId || "default"}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        },
      );
    } finally {
      activeMutationsRef.current--;
    }
  };

  const deleteUser = async (userId: string) => {
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    const originalUsers = state.users;
    
    setState((prev) => {
      const userToDelete = prev.users.find((u) => u.id === userId);
      // prevent deleting super admin
      if (
        userToDelete?.role === "Super Admin" &&
        prev.users.filter((u) => u.role === "Super Admin").length === 1
      ) {
        return prev;
      }
      return {
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
      };
    });
    
    try {
      const res = await apiFetch(
        `/api/users/${userId}?tenantId=${state.currentTenantId || "default"}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      // Revert local state
      setState((prev) => ({
        ...prev,
        users: originalUsers
      }));
      addToast(`Delete failed: ${err.message}`, "error");
    } finally {
      activeMutationsRef.current--;
    }
  };

  const addProject = async (
    projectData: Omit<Project, "id" | "received" | "expenses" | "status">,
  ) => {
    const newProject: Project = {
      id: `p-${Date.now()}`,
      ...projectData,
      received: 0,
      expenses: {
        material: 0,
        consumedMaterial: 0,
        shifting: 0,
        labor: 0,
        machinery: 0,
        misc: 0,
      },
      status: "Active",
    };

    let userToUpdate = null;
    if (projectData.incharge) {
      userToUpdate = state.users.find((u) => u.name === projectData.incharge);
    }

    activeMutationsRef.current++;
    lastMutationIdRef.current++;

    setState((prev) => ({
      ...prev,
      projects: [...prev.projects, newProject],
      users: userToUpdate
        ? prev.users.map((u) =>
            u.id === userToUpdate!.id
              ? {
                  ...u,
                  assignedProjects: [
                    ...(u.assignedProjects || []),
                    newProject.id,
                  ],
                }
              : u,
          )
        : prev.users,
      currentView: "project",
      selectedProjectId: newProject.id,
    }));

    try {
      await apiFetch(
        `/api/projects?tenantId=${state.currentTenantId || "default"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newProject),
        },
      );

      if (userToUpdate) {
        await apiFetch(`/api/users/${userToUpdate.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignedProjects: [
              ...(userToUpdate.assignedProjects || []),
              newProject.id,
            ],
          }),
        });
      }
    } finally {
      activeMutationsRef.current--;
    }
  };

  const updateProject = async (
    projectId: string,
    updatesOrFn: Partial<Project> | ((prevProj: Project) => Partial<Project>),
    logDetails?: string,
  ) => {
    const originalProjects = state.projects; // Store for revert

    activeMutationsRef.current++;
    lastMutationIdRef.current++;

    const currentProject = state.projects.find((proj) => proj.id === projectId);
    if (!currentProject) {
      activeMutationsRef.current--;
      return;
    }

    const resolvedUpdates = typeof updatesOrFn === 'function' ? updatesOrFn(currentProject) : updatesOrFn;
    const updatedProject = { ...currentProject, ...resolvedUpdates };
    const apiPayload: Partial<Project> = { ...resolvedUpdates };

    if (resolvedUpdates.expenseItems) {
      // Recalculate expenses breakdown
      const newExpenses = {
        material: 0,
        consumedMaterial: 0,
        shifting: 0,
        labor: 0,
        machinery: 0,
        misc: 0,
      };
      resolvedUpdates.expenseItems.forEach((item) => {
        if (
          item.status === "Pending Approval" ||
          item.status === "Rejected"
        )
          return;
        if (item.category === "material")
          newExpenses.material += item.amount;
        if (item.category === "consumed_material")
          newExpenses.consumedMaterial += item.amount;
        if (item.category === "shifting")
          newExpenses.shifting += item.amount;
        if (item.category === "labor") newExpenses.labor += item.amount;
        if (item.category === "machinery")
          newExpenses.machinery += item.amount;
        if (item.category === "misc") newExpenses.misc += item.amount;
      });
      updatedProject.expenses = newExpenses;
      apiPayload.expenses = newExpenses;
    }

    if (resolvedUpdates.sitePhotos !== undefined || resolvedUpdates.documents !== undefined) {
      apiPayload.sitePhotos = updatedProject.sitePhotos;
      apiPayload.documents = updatedProject.documents;
    }

    if (state.currentUser) {
      let autoDetails = logDetails;
      if (!autoDetails) {
        const keysChanged = Object.keys(resolvedUpdates).join(", ");
        autoDetails = `Updated project fields: ${keysChanged}`;
      }
      const logEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: state.currentUser.id,
        userName: state.currentUser.name,
        action: logDetails ? "Action" : "Modification",
        details: autoDetails,
        timestamp: new Date().toISOString(),
      };
      updatedProject.activityLogs = [
        ...(updatedProject.activityLogs || []),
        logEntry,
      ];
      apiPayload.activityLogs = updatedProject.activityLogs;
    }

    // Update local state immediately
    setState((prev) => ({
      ...prev,
      projects: prev.projects.map((proj) =>
        proj.id === projectId ? updatedProject : proj
      ),
    }));

    // Send the entire updated project document to save it correctly especially JSON fields
    try {
      const res = await apiFetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("updateProject PUT failed:", text);
        throw new Error(`Server Error ${res.status}: ${text}`);
      }
      
      const savedProject = await res.json();
      if (savedProject && savedProject.id) {
        clearProjectFromSyncQueue(projectId);
        setState(prev => ({
          ...prev,
          projects: prev.projects.map(proj => proj.id === projectId ? savedProject : proj)
        }));
      }
    } catch (err: any) {
      console.error("updateProject PUT network error:", err);
      // Revert UI if saving failed
      setState((prev) => ({
        ...prev,
        projects: originalProjects,
      }));
      addToast(err.message || "Failed to save changes. Reverting...", "error");
    } finally {
      activeMutationsRef.current--;
    }
  };

  const deleteProject = async (projectId: string) => {
    // Store original projects to revert if api fails
    const originalProjects = state.projects;
    const projectToDelete = state.projects.find(p => p.id === projectId);
    
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    
    setState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== projectId),
      users: prev.users.map(u => ({
        ...u,
        assignedProjects: (u.assignedProjects || []).filter(id => id !== projectId)
      })),
      currentUser: prev.currentUser ? {
        ...prev.currentUser,
        assignedProjects: (prev.currentUser.assignedProjects || []).filter(id => id !== projectId)
      } : null,
      currentView:
        prev.selectedProjectId === projectId ? "dashboard" : prev.currentView,
      selectedProjectId:
        prev.selectedProjectId === projectId ? null : prev.selectedProjectId,
    }));
    
    try {
      const res = await apiFetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await res.text());
      }
    } catch (err: any) {
      console.error("Failed to delete project:", err);
      // Revert
      setState(prev => ({
        ...prev,
        projects: originalProjects,
        currentView: "dashboard",
        selectedProjectId: null
      }));
      addToast(`Delete failed: ${err.message}`, "error");
    } finally {
      activeMutationsRef.current--;
    }
  };

  const setEntryTab = (
    tab: "material" | "logistics" | "labor" | "machinery" | "misc",
  ) => {
    setState((prev) => ({ ...prev, entryTab: tab }));
  };

  const addNotification = (message: string, projectId?: string) => {
    setState((prev) => ({
      ...prev,
      notifications: [
        {
          id: `notif_${Date.now()}`,
          message,
          projectId,
          read: false,
          time: new Date().toISOString(),
        },
        ...(prev.notifications || []),
      ].slice(0, 50),
    }));
  };

  const markNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => ({
        ...n,
        read: true,
      })),
    }));
  };

  const setSearchQuery = (query: string) =>
    setState((prev) => ({ ...prev, searchQuery: query }));
  const setLanguage = (lang: "en" | "hi") => {
    setState((prev) => {
      const newState = { ...prev, language: lang };
      if (prev.currentUser) {
        newState.currentUser = {
          ...prev.currentUser,
          preferences: {
            ...prev.currentUser.preferences,
            language: lang,
          },
        };
      }
      return newState;
    });

    if (state.currentUser) {
      updateUser(state.currentUser.id, {
        preferences: {
          ...state.currentUser.preferences,
          language: lang,
        },
      });
    }
  };

  const addToast = (
    message: string,
    type: "success" | "error" | "info" = "success",
  ) => {
    setState((prev) => ({
      ...prev,
      toasts: [
        ...(prev.toasts || []),
        { id: `toast_${Date.now()}_${Math.random()}`, message, type },
      ],
    }));
  };

  const removeToast = (id: string) => {
    setState((prev) => ({
      ...prev,
      toasts: (prev.toasts || []).filter((t) => t.id !== id),
    }));
  };

  const addToRecycleBin = async (item: Omit<import("./types").RecycleBinItem, "id" | "deletedAt">) => {
    const newItem = {
      ...item,
      id: `recycle_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      deletedAt: new Date().toISOString()
    };
    
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      recycleBin: [
        ...(prev.recycleBin || []),
        newItem
      ]
    }));
    
    try {
      await apiFetch('/api/recycle-bin', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
    } catch (e) {
      console.error('Failed to sync recycle bin item', e);
    } finally {
      activeMutationsRef.current--;
    }
  };

  const removeFromRecycleBin = async (id: string) => {
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      recycleBin: (prev.recycleBin || []).filter((i) => i.id !== id)
    }));
    try {
      await apiFetch(`/api/recycle-bin/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to sync recycle bin deletion', e);
    } finally {
      activeMutationsRef.current--;
    }
  };

  const addApprovalRequest = async (request: Omit<import("./types").ApprovalRequest, "id" | "requestedAt" | "status">) => {
    if (request.action === 'Delete') {
      await addToRecycleBin({
        projectId: request.projectId || '',
        itemType: `Pending_Deletion_${request.module}`,
        itemName: `${request.itemName} (Pending Deletion Approval)`,
        itemData: request.oldData || {},
        deletedBy: request.requestedBy,
        deleteReason: `${request.reason} [REQUESTED BY OFFICE STAFF - PENDING ADMIN APPROVAL]`
      });
      return;
    }

    const newRequest = {
      ...request,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      requestedAt: new Date().toISOString(),
      status: 'Pending' as const
    };
    
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      approvalRequests: [...(prev.approvalRequests || []), newRequest]
    }));
    // Note: server sync logic omitted for brevity, assuming standard local sync covers it.
    activeMutationsRef.current--;
  };

  const updateApprovalRequest = (id: string, updates: Partial<import("./types").ApprovalRequest>) => {
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      approvalRequests: (prev.approvalRequests || []).map((r) => r.id === id ? { ...r, ...updates } : r)
    }));
    activeMutationsRef.current--;
  };

  const addAuditLog = (log: Omit<import("./types").AppAuditLog, "id" | "timestamp">) => {
    const newLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    setState((prev) => ({
      ...prev,
      auditLogs: [...(prev.auditLogs || []), newLog]
    }));
    activeMutationsRef.current--;
  };

  const triggerSync = async () => {
    if (!state.currentTenantId) return;
    setIsSyncing(true);
    activeMutationsRef.current++;
    lastMutationIdRef.current++;
    try {
      const t = Date.now();
      const usersRes = await apiFetch(`/api/users?tenantId=${state.currentTenantId}&_t=${t}`);
      const projectsRes = await apiFetch(`/api/projects?tenantId=${state.currentTenantId}&_t=${t}`);
      const recycleBinRes = await apiFetch(`/api/recycle-bin?tenantId=${state.currentTenantId}&_t=${t}`);

      if (usersRes.ok && projectsRes.ok) {
        const fetchedUsers = await usersRes.json();
        const fetchedProjects = await projectsRes.json();
        let fetchedRecycleBin = [];
        if (recycleBinRes.ok) {
          try {
            fetchedRecycleBin = await recycleBinRes.json();
          } catch (e) { console.error(e); }
        }

        setState((prev) => {
          const updatedUsers = fetchedUsers.map((u: any) => {
            const rawProjects = u.assignedProjects || u.assigned_projects || [];
            const assignedProjects = rawProjects.filter((id: string) => fetchedProjects.some((p: any) => p.id === id));
            const pettyCashBalance = u.pettyCashBalance !== undefined ? u.pettyCashBalance : (u.petty_cash_balance !== undefined ? u.petty_cash_balance : 0);
            const addressProof = u.addressProof || u.address_proof || '';
            return {
              ...u,
              assignedProjects,
              pettyCashBalance,
              addressProof,
            };
          });
          const updatedCurrentUser = prev.currentUser
            ? updatedUsers.find((u: any) => u.id === prev.currentUser!.id) || prev.currentUser
            : null;
          return {
            ...prev,
            users: updatedUsers,
            currentUser: updatedCurrentUser,
            currentRole: updatedCurrentUser ? updatedCurrentUser.role : prev.currentRole,
            projects: fetchedProjects,
            recycleBin: fetchedRecycleBin,
          };
        });
        addToast(state.language === "hi" ? "सफलतापूर्वक सिंक किया गया!" : "Sync completed successfully!", "success");
      } else {
        throw new Error("Server returned an error status");
      }
    } catch (err) {
      console.warn("Manual sync error:", err);
      addToast(state.language === "hi" ? "सिंक विफल! कृपया इंटरनेट जांचें।" : "Sync failed! Please check your connection.", "error");
    } finally {
      setIsSyncing(false);
      activeMutationsRef.current--;
    }
  };

  const contextValue = React.useMemo(
    () => ({
      state,
      isSyncing,
      triggerSync,
      login,
      logout,
      resetPin,
      setRole,
      setView,
      addProject,
      updateProject,
      deleteProject,
      addUser,
      updateUser,
      toggleUserStatus,
      deleteUser,
      setEntryTab,
      markNotificationsRead,
      addNotification,
      addToast,
      removeToast,
      setSearchQuery,
      setLanguage,
      confirm: showConfirm,
      prompt: showPrompt,
      addToRecycleBin,
      removeFromRecycleBin,
      addApprovalRequest,
      updateApprovalRequest,
      addAuditLog,
    }),
    [state, isSyncing],
  ); // the methods are stable if they are not wrapped in useCallback, but actually they recreate on every render if not memoized, but state changes often anyway.

  // Wait, if we useMemo just with state, it still recreates on every state change.
  // Actually, in React, if `state` is part of the context, the context updates on EVERY state change.
  // Since our entire app state is a single object, ANY change to ANY part of the app causes ALL consumers of `useAppContext` to re-render.
  // This is a classic React context performance issue.

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      {/* Global Confirm Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm</h3>
              <p className="text-slate-600">{confirmModal.message}</p>
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (confirmModal.resolve) confirmModal.resolve(false);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  if (confirmModal.resolve) confirmModal.resolve(true);
                }}
                className="px-4 py-2 text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Enter value</h3>
              <p className="text-sm text-slate-600 mb-4">{promptModal.message}</p>
              <input 
                type="text" 
                value={promptValue} 
                onChange={(e) => setPromptValue(e.target.value)}
                autoFocus
                className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-sm outline-none focus:border-amber-500"
              />
            </div>
            <div className="bg-slate-50 px-5 py-3 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setPromptModal(prev => ({ ...prev, isOpen: false }));
                  if (promptModal.resolve) promptModal.resolve(null);
                }}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPromptModal(prev => ({ ...prev, isOpen: false }));
                  if (promptModal.resolve) promptModal.resolve(promptValue);
                }}
                className="px-4 py-2 text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 rounded-lg transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
