import React, { useState, useEffect } from "react";
import {
  Box,
  Truck,
  Users,
  Settings2,
  Receipt,
  Mic,
  Camera,
  FileCheck2,
  Save,
  History,
  Clock,
  Power,
  Edit2,
  Trash2,
  X,
  WifiOff,
  FileText,
  AlertCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAppContext } from "../store";
import { LiveCameraModal } from "./LiveCameraModal";

type Tab = "material" | "logistics" | "labor" | "machinery" | "misc" | "photos" | "shifting" | "petty_cash";

const dict: Record<string, { en: string; hi: string }> = {
  material: { en: "Material", hi: "सामग्री (Material)" },
  logistics: { en: "Shifting", hi: "शिफ्टिंग / भाड़ा (Shifting)" },
  labor: { en: "Labour", hi: "मज़दूर (Labour)" },
  machinery: { en: "Machinery", hi: "मशीनरी (Machinery)" },
  misc: { en: "Petty Cash", hi: "नकद खर्च (Petty Cash)" },
};

function getMaterialFamily(
  itemName: string,
): "aggregate" | "cement" | "pieces" | "metals" | "default" {
  const name = itemName.toLowerCase();
  if (
    name.includes("sand") ||
    name.includes("aggregate") ||
    name.includes("rori") ||
    name.includes("dust") ||
    name.includes("grit") ||
    name.includes("bajri") ||
    name.includes("soil") ||
    name.includes("mitti") ||
    name.includes("stone") ||
    name.includes("crusher") ||
    name.includes("cuft") ||
    name.includes("cft")
  ) {
    return "aggregate";
  }
  if (
    name.includes("cement") ||
    name.includes("putty") ||
    name.includes("pop") ||
    name.includes("plaster")
  ) {
    return "cement";
  }
  if (
    name.includes("brick") ||
    name.includes("block") ||
    name.includes("tile") ||
    name.includes("pipe") ||
    name.includes("fitting")
  ) {
    return "pieces";
  }
  if (
    name.includes("steel") ||
    name.includes("saria") ||
    name.includes("iron") ||
    name.includes("metal") ||
    name.includes("wire") ||
    name.includes("nail")
  ) {
    return "metals";
  }
  return "default";
}

function convertMaterialQuantity(
  itemName: string,
  fromUnit: string,
  toUnit: string,
): number {
  const cleanFrom = fromUnit.trim().toLowerCase();
  const cleanTo = toUnit.trim().toLowerCase();
  if (cleanFrom === cleanTo) return 1;

  const family = getMaterialFamily(itemName);

  const conversions: Record<string, Record<string, number>> = {
    aggregate: {
      cuft: 1,
      cft: 1,
      "cubic m": 35.315,
      "cubic meter": 35.315,
      "tons (mt)": 26,
      ton: 26,
      quintal: 2.6,
      kg: 0.026,
      trolley: 100,
      bags: 1.25,
      piece: 1,
      numbers: 1,
      "lot/bill": 1,
    },
    cement: {
      bags: 1,
      bag: 1,
      piece: 1,
      numbers: 1,
      kg: 0.02,
      quintal: 2,
      "tons (mt)": 20,
      ton: 20,
      trolley: 100,
      cuft: 1.25,
      cft: 1.25,
      "lot/bill": 1,
    },
    pieces: {
      piece: 1,
      pieces: 1,
      numbers: 1,
      number: 1,
      trolley: 2000,
      bags: 1,
      kg: 1,
      "lot/bill": 1,
    },
    metals: {
      kg: 1,
      "kg.": 1,
      quintal: 100,
      "tons (mt)": 1000,
      ton: 1000,
      piece: 10,
      numbers: 10,
      "lot/bill": 1,
    },
    default: {
      bags: 1,
      cuft: 1,
      cft: 1,
      "cubic m": 1,
      "tons (mt)": 1,
      quintal: 1,
      trolley: 1,
      piece: 1,
      kg: 1,
      numbers: 1,
      "lot/bill": 1,
    },
  };

  const familyConversions = conversions[family] || conversions.default;

  const fromBaseVal = familyConversions[cleanFrom] || 1;
  const toBaseVal = familyConversions[cleanTo] || 1;

  return fromBaseVal / toBaseVal;
}

export function getConversionInfo(
  itemName: string,
  vendorUnit: string,
): { standardUnit: string; defaultFactor: number } {
  const family = getMaterialFamily(itemName);
  let standardUnit = "Bags";
  if (family === "aggregate") standardUnit = "CuFt";
  else if (family === "pieces") standardUnit = "Numbers";
  else if (family === "metals") standardUnit = "Kg";
  else if (family === "cement") standardUnit = "Bags";
  else standardUnit = vendorUnit; // Fallback

  const defaultFactor = convertMaterialQuantity(
    itemName,
    vendorUnit,
    standardUnit,
  );
  return { standardUnit, defaultFactor };
}

export function MunshiEntry() {
  const {
    state,
    setView,
    updateProject,
    updateUser,
    addNotification,
    addToast,
    confirm,
    addApprovalRequest,
    addToRecycleBin,
  } = useAppContext();
  const isAdminOrOffice =
    state.currentRole === "Super Admin" ||
    state.currentRole === "Admin" ||
    state.currentRole === "Office Staff";
  const isAutoApproved = 
    state.currentRole === "Super Admin" ||
    state.currentRole === "Admin";
  const isSiteStaff =
    state.currentRole === "Munshi" || state.currentRole === "Site Incharge";
  const [activeTab, setActiveTab] = useState<Tab>(state.entryTab || "material");
  const [selectedProjectIdForEntry, setSelectedProjectIdForEntry] = useState(
    state.selectedProjectId || "",
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editLogForm, setEditLogForm] = useState<Partial<any>>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const [livePhoto, setLivePhoto] = useState("");
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const currentCoordinates = React.useRef<{ lat: number; lng: number; alt?: number | null } | null>(
    null,
  );

  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [onCameraCapture, setOnCameraCapture] = useState<
    ((base64: string) => void) | null
  >(null);
  const [gpsCoords, setGpsCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [activeSpeechField, setActiveSpeechField] = useState<string | null>(null);

  const startListening = async (fieldId: string, onResult: (text: string) => void) => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addToast(state.language === 'hi' ? "आपका ब्राउज़र वॉइस टाइपिंग सपोर्ट नहीं करता।" : "Voice recognition is not supported in this browser.", "error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.error("Microphone permission error", err);
      addToast(state.language === 'hi' ? "कृपया ब्राउज़र सेटिंग में माइक्रोफ़ोन की अनुमति दें।" : "Please allow microphone access in your browser settings.", "error");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = state.language === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
      setIsListening(true);
      setActiveSpeechField(fieldId);
    };
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        addToast(state.language === 'hi' ? "कृपया ब्राउज़र सेटिंग में माइक्रोफ़ोन की अनुमति दें।" : "Please allow microphone access in your browser settings.", "error");
      } else {
        addToast(state.language === 'hi' ? "वॉइस टाइपिंग विफल: " + event.error : "Voice typing failed: " + event.error, "error");
      }
      setIsListening(false);
      setActiveSpeechField(null);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };
    
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start recognition:", e);
      setIsListening(false);
      setActiveSpeechField(null);
    }
  };

  const openLiveCamera = async (callback: (base64: string) => void) => {
    const proceed = await confirm(
      state.language === "hi"
        ? "साइट की असली फोटो और जगह की पुष्टि (Verification) के लिए कैमरा और लोकेशन की परमिशन ज़रूरी है। कृपया अगली स्क्रीन पर 'Allow' दबाएं।"
        : "Camera and location permissions are required for live site verification. Please click 'Allow' on the next prompt."
    );
    if (!proceed) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setGpsCoords(coords);
          currentCoordinates.current = coords;
        },
        (err) => {
          console.warn("Geolocation fetch failed", err);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }

    setOnCameraCapture(() => callback);
    setIsCameraOpen(true);
  };

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const t = (key: string) => {
    return dict[key] ? dict[key][state.language === "hi" ? "hi" : "en"] : key;
  };

  React.useEffect(() => {
    if (state.entryTab) {
      setActiveTab(state.entryTab);
    }
  }, [state.entryTab]);

  const [logisticsForm, setLogisticsForm] = useState({
    vehicleType: "Tractor Trolley",
    materialShifted: "",
    ratePerTrip: "",
    totalTrips: "",
    shifterName: "",
    paidBy: "unpaid",
    photo: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [laborList, setLaborList] = useState<import("../types").LaborEntry[]>(
    [],
  );
  const [attendanceDate, setAttendanceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showArchivedLabors, setShowArchivedLabors] = useState(false);
  const [newLaborModal, setNewLaborModal] = useState(false);
  const [newLaborForm, setNewLaborForm] = useState({
    name: "",
    type: "Mistri",
    customType: "",
    rate: "",
    phone: "",
    address: "",
    photo: "",
  });

  React.useEffect(() => {
    if (selectedProjectIdForEntry) {
      const p = state.projects.find((p) => p.id === selectedProjectIdForEntry);
      if (p && p.labors) {
        setLaborList(
          p.labors.map((l) => {
            const pastAtt = l.attendance?.find(
              (a) => a.date === attendanceDate,
            );
            return {
              ...l,
              status: pastAtt?.status || "",
              advance: pastAtt?.advance ? String(pastAtt.advance) : "",
            };
          }),
        );
      } else {
        setLaborList([]);
      }
    }
  }, [selectedProjectIdForEntry, state.projects, attendanceDate]);

  const [machineryForm, setMachineryForm] = useState({
    machineName: "JCB",
    customMachine: "",
    chargeType: "hourly",
    startMeter: "",
    endMeter: "",
    workHoursOrDays: "",
    workMinutes: "",
    rate: "",
    fuelSlipAmount: "",
    litersFilled: "",
    fuelPhoto: "",
    paidBy: "unpaid",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  const [miscForm, setMiscForm] = useState({
    detail: "",
    amountPaid: "",
    photo: "",
    paidBy: "petty_cash", // usually petty cash
    date: new Date().toISOString().split("T")[0],
  });

  const [photosForm, setPhotosForm] = useState<{
    file: File | null;
    base64: string;
    description: string;
    category: 'Progress Photo' | 'Before Work' | 'During Work' | 'After Completion' | 'Issue / Damage';
    latitude?: number;
    longitude?: number;
    date: string;
  }>({ file: null, base64: "", description: "", category: "Progress Photo", date: new Date().toISOString().split("T")[0] });

  const [laborPaidBy, setLaborPaidBy] = useState("petty_cash");

  const handlePhotosSave = async () => {
    if (!selectedProjectIdForEntry)
      return addToast("Select a project first", "error");
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;
    if (!photosForm.base64) {
      return addToast("Please select a photo first", "error");
    }
    const isAdminOrOffice = state.currentRole === 'Super Admin' || state.currentRole === 'Admin' || state.currentRole === 'Office Staff';
    const newDoc = {
      id: `photo-${Date.now()}`,
      name: photosForm.file?.name || `Photo_Upload_${new Date().getTime()}.jpg`,
      type: photosForm.file?.type || "image/jpeg",
      data: photosForm.base64,
      uploadedAt: photosForm.date ? new Date(photosForm.date).toISOString() : new Date().toISOString(),
      description: photosForm.description, // for backward compatibility
      remarks: photosForm.description, // using description field for remarks
      uploadedBy: state.currentUser?.name,
      uploadedById: state.currentUser?.id,
      status: (isAutoApproved ? 'Approved' : 'Pending Approval') as 'Pending Approval' | 'Approved',
      category: photosForm.category,
      latitude: photosForm.latitude || gpsCoords?.lat,
      longitude: photosForm.longitude || gpsCoords?.lng,
      dateTaken: photosForm.date ? new Date(photosForm.date).toISOString() : new Date().toISOString()
    };
    
    updateProject(project.id, {
      sitePhotos: [...(project.sitePhotos || []), newDoc]
    });


    addNotification(
      `Site photo pending approval by ${state.currentUser?.name} in project ${project.name}`,
      project.id
    );
    addToast("Photo uploaded and pending approval!", "success");
    setPhotosForm({ file: null, base64: "", description: "", category: "Progress Photo", date: new Date().toISOString().split("T")[0] });
  };

  const handleLogisticsSave = () => {
    if (!selectedProjectIdForEntry)
      return addToast("Select a project first", "error");
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;

    if (!logisticsForm.ratePerTrip || !logisticsForm.totalTrips) {
      return addToast("Rate and Total Trips are required", "error");
    }

    const amount =
      Number(logisticsForm.ratePerTrip) * Number(logisticsForm.totalTrips);

    const newItem: import("../types").ExpenseEntry = {
      id: `exp_${Date.now()}`,
      category: "shifting",
      date: logisticsForm.date || new Date().toISOString().split("T")[0],
      itemName: `${logisticsForm.vehicleType} - ${logisticsForm.materialShifted || "Shifting"}`,
      quantity: `${logisticsForm.totalTrips} Trips`,
      rate: Number(logisticsForm.ratePerTrip),
      amount: amount,
      vendor: logisticsForm.shifterName || "",
      vehicleNo: "",
      hasInvoice: !!logisticsForm.photo,
      photo: logisticsForm.photo,
      livePhoto: livePhoto || undefined,
      entryLatitude: currentCoordinates.current?.lat,
      entryLongitude: currentCoordinates.current?.lng,
      submittedBy: state.currentUser?.name,
      submittedByRole: state.currentUser?.role,
      submittedById: state.currentUser?.id,
      paidBy: logisticsForm.paidBy as any,
      status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
      shifterName: logisticsForm.shifterName || "",
    };

    updateProject(project.id, {
      expenseItems: [...(project.expenseItems || []), newItem],
    });

    if (
      isAdminOrOffice &&
      newItem.paidBy === "petty_cash" &&
      state.currentUser
    ) {
      updateUser(state.currentUser.id, {
        pettyCashBalance: (state.currentUser.pettyCashBalance || 0) - amount,
      });
    }

    addNotification(
      `Shifting entry added by ${state.currentUser?.name} in project ${project.name}`,
      project.id,
    );
    addToast("Shifting Entry Saved Successfully!", "success");
    setLogisticsForm({
      ...logisticsForm,
      totalTrips: "",
      shifterName: "",
      photo: "",
    });
  };

  const handleLaborSave = () => {
    if (!selectedProjectIdForEntry)
      return addToast("Select a project first", "error");
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;

    let updatedExpenseItems = [...(project.expenseItems || [])];
    const today = attendanceDate;
    let skippedCount = 0;

    laborList.forEach((l) => {
      const wageItemName = `${l.name} (${l.type}) - Daily Wage`;
      const advItemName = `Advance to ${l.name}`;

      const existingWageIdx = updatedExpenseItems.findIndex(
        (e) =>
          e.date === today &&
          e.category === "labor" &&
          e.itemName === wageItemName,
      );
      const existingAdvIdx = updatedExpenseItems.findIndex(
        (e) =>
          e.date === today &&
          e.category === "misc" &&
          e.itemName === advItemName,
      );

      // Skip if approved and user is not admin
      if (!isAdminOrOffice) {
        if (
          (existingWageIdx > -1 &&
            updatedExpenseItems[existingWageIdx].status === "Approved") ||
          (existingAdvIdx > -1 &&
            updatedExpenseItems[existingAdvIdx].status === "Approved")
        ) {
          skippedCount++;
          return;
        }
      }

      if (l.status === "P" || l.status === "H") {
        const isHalfDay = l.status === "H";
        const wageAmount = isHalfDay ? l.rate / 2 : l.rate;
        const wageQuantity = isHalfDay ? "0.5 Day" : "1 Day";

        if (existingWageIdx > -1) {
          updatedExpenseItems[existingWageIdx] = {
            ...updatedExpenseItems[existingWageIdx],
            amount: wageAmount,
            rate: l.rate,
            quantity: wageQuantity,
          };
        } else {
          updatedExpenseItems.push({
            id: `exp_${Date.now()}_${Math.random()}`,
            category: "labor" as const,
            date: today,
            itemName: wageItemName,
            quantity: wageQuantity,
            rate: l.rate,
            amount: wageAmount,
            vendor: "",
            vehicleNo: "",
            hasInvoice: false,
            livePhoto: livePhoto || undefined,
            entryLatitude: currentCoordinates.current?.lat,
            entryLongitude: currentCoordinates.current?.lng,
            submittedBy: state.currentUser?.name,
            submittedByRole: state.currentUser?.role,
            submittedById: state.currentUser?.id,
            paidBy: "unpaid",
            status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
          });
        }
      } else {
        // If status is A or cleared
        if (existingWageIdx > -1) {
          updatedExpenseItems = updatedExpenseItems.filter(
            (_, idx) => idx !== existingWageIdx,
          );
        }
      }

      // We must recalculate indices in case array was filtered!
      const finalAdvIdx = updatedExpenseItems.findIndex(
        (e) =>
          e.date === today &&
          e.category === "misc" &&
          e.itemName === advItemName,
      );

      if (l.advance && Number(l.advance) > 0) {
        if (finalAdvIdx > -1) {
          const oldAdv = updatedExpenseItems[finalAdvIdx].amount;
          updatedExpenseItems[finalAdvIdx] = {
            ...updatedExpenseItems[finalAdvIdx],
            amount: Number(l.advance),
            rate: Number(l.advance),
          };
          if (isAutoApproved && state.currentUser) {
            const diff = Number(l.advance) - oldAdv;
            if (diff !== 0) {
              updateUser(state.currentUser.id, {
                pettyCashBalance:
                  (state.currentUser.pettyCashBalance || 0) - diff,
              });
            }
          }
        } else {
          updatedExpenseItems.push({
            id: `exp_${Date.now()}_${Math.random()}`,
            category: "misc" as const,
            date: today,
            itemName: advItemName,
            quantity: `1`,
            rate: Number(l.advance),
            amount: Number(l.advance),
            vendor: "",
            hasInvoice: false,
            livePhoto: livePhoto || undefined,
            entryLatitude: currentCoordinates.current?.lat,
            entryLongitude: currentCoordinates.current?.lng,
            submittedBy: state.currentUser?.name,
            submittedByRole: state.currentUser?.role,
            submittedById: state.currentUser?.id,
            paidBy: laborPaidBy as any,
            status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
          });
          if (isAdminOrOffice && state.currentUser && laborPaidBy === "petty_cash") {
            updateUser(state.currentUser.id, {
              pettyCashBalance:
                (state.currentUser.pettyCashBalance || 0) - Number(l.advance),
            });
          }
        }
      } else {
        if (finalAdvIdx > -1) {
          const oldAdv = updatedExpenseItems[finalAdvIdx].amount;
          updatedExpenseItems = updatedExpenseItems.filter(
            (_, idx) => idx !== finalAdvIdx,
          );
          if (isAdminOrOffice && state.currentUser) {
            updateUser(state.currentUser.id, {
              pettyCashBalance:
                (state.currentUser.pettyCashBalance || 0) + oldAdv,
            });
          }
        }
      }
    });

    const updatedLabors =
      project.labors?.map((orig) => {
        const formLabor = laborList.find((lb) => lb.id === orig.id);
        if (formLabor) {
          const filteredAtt = (orig.attendance || []).filter(
            (a) => a.date !== today,
          );
          if (formLabor.status || formLabor.advance) {
            return {
              ...orig,
              attendance: [
                ...filteredAtt,
                {
                  date: today,
                  status: formLabor.status || "",
                  advance: Number(formLabor.advance) || 0,
                },
              ],
            };
          } else {
            return {
              ...orig,
              attendance: filteredAtt,
            };
          }
        }
        return orig;
      }) || [];

    updateProject(project.id, {
      expenseItems: updatedExpenseItems,
      labors: updatedLabors,
    });
    addNotification(
      `Labor attendance marked by ${state.currentUser?.name} in project ${project.name}`,
      project.id,
    );
    if (skippedCount > 0) {
      addToast(
        `Saved, but ${skippedCount} entries were not modified because they are already Approved.`,
        "info",
      );
    } else {
      addToast("Labor Entry Saved Successfully!", "success");
    }
  };

  const handleMachinerySave = () => {
    if (!selectedProjectIdForEntry)
      return addToast("Select a project first", "error");
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;

    if (!machineryForm.rate) return addToast("Rate is required", "error");
    if (!machineryForm.workHoursOrDays && !machineryForm.workMinutes)
      return addToast("Work duration is required", "error");

    const totalHours =
      machineryForm.chargeType === "hourly"
        ? Number(machineryForm.workHoursOrDays || 0) +
          Number(machineryForm.workMinutes || 0) / 60
        : Number(machineryForm.workHoursOrDays || 0);

    const amount = Number(machineryForm.rate) * totalHours;
    const finalMachineName =
      machineryForm.machineName === "Other"
        ? machineryForm.customMachine
        : machineryForm.machineName;

    let qtyStr = "";
    if (machineryForm.chargeType === "hourly") {
      qtyStr = `${machineryForm.workHoursOrDays || 0} Hrs`;
      if (machineryForm.workMinutes)
        qtyStr += ` ${machineryForm.workMinutes} Mins`;
    } else {
      qtyStr = `${machineryForm.workHoursOrDays} Days`;
    }

    let fuelStr = "";
    if (machineryForm.fuelSlipAmount || machineryForm.litersFilled) {
      fuelStr = ` [Fuel: ₹${machineryForm.fuelSlipAmount || 0} (${machineryForm.litersFilled || 0}L)]`;
    }

    const newItem: import("../types").ExpenseEntry = {
      id: `exp_${Date.now()}`,
      category: "machinery",
      date: machineryForm.date || new Date().toISOString().split("T")[0],
      itemName: `Machinery: ${finalMachineName}${fuelStr}`,
      quantity: qtyStr,
      rate: Number(machineryForm.rate),
      amount: amount,
      vendor: "",
      vehicleNo: "",
      hasInvoice: !!machineryForm.fuelPhoto,
      photo: machineryForm.fuelPhoto || "",
      livePhoto: livePhoto || undefined,
      description: machineryForm.description,
      entryLatitude: currentCoordinates.current?.lat,
      entryLongitude: currentCoordinates.current?.lng,
      submittedBy: state.currentUser?.name,
      submittedByRole: state.currentUser?.role,
      submittedById: state.currentUser?.id,
      paidBy: machineryForm.paidBy as any,
      status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
    };

    updateProject(project.id, {
      expenseItems: [...(project.expenseItems || []), newItem],
    });

    if (
      isAdminOrOffice &&
      newItem.paidBy === "petty_cash" &&
      state.currentUser
    ) {
      updateUser(state.currentUser.id, {
        pettyCashBalance: (state.currentUser.pettyCashBalance || 0) - amount,
      });
    }

    addNotification(
      `Machinery entry added by ${state.currentUser?.name} in project ${project.name}`,
      project.id,
    );
    addToast("Machinery Entry Saved Successfully!", "success");

    setMachineryForm({
      ...machineryForm,
      startMeter: "",
      endMeter: "",
      workHoursOrDays: "",
      workMinutes: "",
      fuelSlipAmount: "",
      litersFilled: "",
      fuelPhoto: "",
      description: "",
    });
  };

  const handleMiscSave = () => {
    if (!selectedProjectIdForEntry)
      return addToast("Select a project first", "error");
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;

    if (!miscForm.amountPaid || !miscForm.detail)
      return addToast("Detail and Amount are required", "error");

    const amount = Number(miscForm.amountPaid);
    const prefix =
      miscForm.paidBy === "petty_cash"
        ? "Petty Cash"
        : miscForm.paidBy === "office"
          ? "Office Expense"
          : "Expense";
    const newItem: import("../types").ExpenseEntry = {
      id: `exp_${Date.now()}`,
      category: "misc",
      date: miscForm.date || new Date().toISOString().split("T")[0],
      itemName: `${prefix}: ${miscForm.detail}`,
      quantity: `1`,
      rate: amount,
      amount: amount,
      vendor: "",
      vehicleNo: "",
      hasInvoice: !!miscForm.photo,
      photo: miscForm.photo || "",
      livePhoto: livePhoto || undefined,
      entryLatitude: currentCoordinates.current?.lat,
      entryLongitude: currentCoordinates.current?.lng,
      submittedBy: state.currentUser?.name,
      submittedById: state.currentUser?.id,
      submittedByRole: state.currentUser?.role,
      status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
      paidBy: miscForm.paidBy as any,
    };

    updateProject(project.id, {
      expenseItems: [...(project.expenseItems || []), newItem],
    });

    if (
      isAutoApproved &&
      state.currentUser &&
      miscForm.paidBy === "petty_cash"
    ) {
      if (
        state.currentUser.role !== "Admin" &&
        state.currentUser.role !== "Super Admin"
      ) {
        const currentBal = state.currentUser.pettyCashBalance || 0;
        updateUser(state.currentUser.id, {
          pettyCashBalance: currentBal - amount,
        });
      }
    }

    if (isAutoApproved) {
      addNotification(
        `Petty Cash spent by ${state.currentUser?.name} in project ${project.name}`,
        project.id,
      );
      addToast("Petty Cash Entry Saved Successfully!", "success");
    } else {
      addNotification(
        `Pending Petty Cash approval requested by ${state.currentUser?.name} in project ${project.name}`,
        project.id,
      );
      addToast("Petty Cash Entry Submitted for Approval!", "success");
    }

    setMiscForm({ ...miscForm, detail: "", amountPaid: "", photo: "" });
  };

  const [materialForm, setMaterialForm] = useState({
    itemName: "",
    customItem: "",
    quantity: "",
    unit: "Bags",
    rate: "",
    vendor: "",
    vehicleNo: "",
    description: "",
    entryType: "received",
    paidBy: "unpaid",
    photo: "",
    customConversionFactor: "",
    date: new Date().toISOString().split("T")[0],
  });

  React.useEffect(() => {
    if (isAdminOrOffice) {
      if (miscForm.paidBy === "petty_cash") {
        setMiscForm((prev) => ({ ...prev, paidBy: "office" }));
      }
      if (logisticsForm.paidBy === "petty_cash" || logisticsForm.paidBy === "unpaid") {
        setLogisticsForm((prev) => ({ ...prev, paidBy: "office" }));
      }
      if (machineryForm.paidBy === "petty_cash" || machineryForm.paidBy === "unpaid") {
        setMachineryForm((prev) => ({ ...prev, paidBy: "office" }));
      }
      if (materialForm.paidBy === "petty_cash" || materialForm.paidBy === "unpaid") {
        setMaterialForm((prev) => ({ ...prev, paidBy: "office" }));
      }
    } else {
      if (miscForm.paidBy === "office") {
        setMiscForm((prev) => ({ ...prev, paidBy: "petty_cash" }));
      }
      if (logisticsForm.paidBy === "office") {
        setLogisticsForm((prev) => ({ ...prev, paidBy: "unpaid" }));
      }
      if (machineryForm.paidBy === "office") {
        setMachineryForm((prev) => ({ ...prev, paidBy: "unpaid" }));
      }
      if (materialForm.paidBy === "office") {
        setMaterialForm((prev) => ({ ...prev, paidBy: "unpaid" }));
      }
    }
  }, [isAdminOrOffice]);

  const liveFinalItemName =
    materialForm.itemName === "Other"
      ? materialForm.customItem
      : materialForm.itemName;

  const conversionInfo = getConversionInfo(
    liveFinalItemName,
    materialForm.unit,
  );
  const conversionFactor =
    materialForm.customConversionFactor !== ""
      ? Number(materialForm.customConversionFactor)
      : conversionInfo.defaultFactor;

  const calculatedStandardQty = Number(materialForm.quantity)
    ? Number(materialForm.quantity) * conversionFactor
    : 0;
  const calculatedStandardRate =
    Number(materialForm.rate) && conversionFactor > 0
      ? Number(materialForm.rate) / conversionFactor
      : 0;
  const totalAmount =
    Number(materialForm.quantity) && Number(materialForm.rate)
      ? Math.round(Number(materialForm.quantity) * Number(materialForm.rate))
      : 0;

  const handleMaterialSave = () => {
    if (!selectedProjectIdForEntry) {
      addToast("Please select a project first.", "error");
      return;
    }
    if (!materialForm.itemName) {
      addToast(
        state.language === "hi"
          ? "कृपया सामग्री का प्रकार चुनें"
          : "Please select a material type",
        "error",
      );
      return;
    }
    const project = state.projects.find(
      (p) => p.id === selectedProjectIdForEntry,
    );
    if (!project) return;

    if (!materialForm.quantity) {
      addToast("Quantity is required", "error");
      return;
    }

    const finalItemName =
      materialForm.itemName === "Other"
        ? materialForm.customItem
        : materialForm.itemName;

    const conversionInfo = getConversionInfo(finalItemName, materialForm.unit);
    const conversionFactor =
      materialForm.customConversionFactor !== ""
        ? Number(materialForm.customConversionFactor)
        : conversionInfo.defaultFactor;

    const calculatedStandardQty = Number(materialForm.quantity)
      ? Number(materialForm.quantity) * conversionFactor
      : 0;
    const calculatedStandardRate =
      Number(materialForm.rate) && conversionFactor > 0
        ? Number(materialForm.rate) / conversionFactor
        : 0;
    const totalAmount =
      materialForm.entryType === "consumed"
        ? 0
        : Number(materialForm.quantity) && Number(materialForm.rate)
          ? Math.round(
              Number(materialForm.quantity) * Number(materialForm.rate),
            )
          : 0;

    const itemNameLabel =
      materialForm.entryType === "consumed"
        ? `[Consumed] ${finalItemName}`
        : finalItemName;

    const categoryStr =
      materialForm.entryType === "consumed" ? "consumed_material" : "material";

    const newItem: import("../types").ExpenseEntry = {
      id: `exp_${Date.now()}`,
      category: categoryStr,
      date: materialForm.date || new Date().toISOString().split("T")[0],
      itemName:
        `${itemNameLabel} ${materialForm.description ? `(${materialForm.description})` : ""}`.trim(),
      quantity:
        materialForm.entryType === "consumed"
          ? `${materialForm.quantity} ${materialForm.unit}`
          : `${calculatedStandardQty.toFixed(2).replace(/\.00$/, "")} ${conversionInfo.standardUnit}`,
      rate:
        materialForm.entryType === "consumed"
          ? 0
          : Number(calculatedStandardRate.toFixed(2)),
      amount: totalAmount,
      vendor: materialForm.entryType === "received" ? materialForm.vendor : "",
      vehicleNo:
        materialForm.entryType === "received" ? materialForm.vehicleNo : "",
      vendorQuantity:
        materialForm.entryType === "received"
          ? Number(materialForm.quantity)
          : undefined,
      vendorUnit:
        materialForm.entryType === "received" ? materialForm.unit : undefined,
      vendorRate:
        materialForm.entryType === "received"
          ? Number(materialForm.rate)
          : undefined,
      conversionFactor:
        materialForm.entryType === "received" ? conversionFactor : undefined,
      hasInvoice: !!materialForm.photo,
      photo: materialForm.photo,
      livePhoto: livePhoto || undefined,
      entryLatitude: currentCoordinates.current?.lat,
      entryLongitude: currentCoordinates.current?.lng,
      submittedBy: state.currentUser?.name,
      submittedByRole: state.currentUser?.role,
      submittedById: state.currentUser?.id,
      paidBy:
        materialForm.entryType === "consumed"
          ? "used"
          : (materialForm.paidBy as any),
      status: (isAutoApproved ? "Approved" : "Pending Approval") as any,
    };

    updateProject(project.id, {
      expenseItems: [...(project.expenseItems || []), newItem],
    });

    if (
      isAdminOrOffice &&
      newItem.paidBy === "petty_cash" &&
      state.currentUser
    ) {
      updateUser(state.currentUser.id, {
        pettyCashBalance:
          (state.currentUser.pettyCashBalance || 0) - totalAmount,
      });
    }

    addNotification(
      `Material entry added by ${state.currentUser?.name} in project ${project.name}`,
      project.id,
    );
    addToast("Material Entry Saved Successfully!", "success");

    // Reset form partially to allow rapid entry
    setMaterialForm({
      ...materialForm,
      quantity: "",
      rate: "",
      description: "",
      customConversionFactor: "",
      customItem:
        materialForm.itemName === "Other" ? materialForm.customItem : "",
      photo: "",
    });
  };

  const tabs = [
    { id: "material", label: t("material"), icon: Box },
    { id: "logistics", label: t("logistics"), icon: Truck },
    { id: "labor", label: t("labor"), icon: Users },
    { id: "machinery", label: t("machinery"), icon: Settings2 },
    { id: "misc", label: t("misc"), icon: Receipt },
    { id: "photos", label: state.language === "hi" ? "तस्वीरें (Photos)" : "Photos", icon: Camera },
  ] as {
    id: "material" | "logistics" | "labor" | "machinery" | "misc" | "photos";
    label: string;
    icon: any;
  }[];

  const assignedProjectsList = state.currentUser?.assignedProjects || (state.currentUser as any)?.assigned_projects || [];
  const showProjectSelector =
    isAdminOrOffice || (assignedProjectsList.length || 0) > 1;
  const availableProjects = isAdminOrOffice
    ? state.projects
    : state.projects.filter((p) =>
        assignedProjectsList.includes(p.id),
      );

  const currentProjectForBal = state.projects.find(p => p.id === selectedProjectIdForEntry) || state.projects.find(p => p.id === assignedProjectsList[0]);
  let projectReceived = 0;
  let projectSpent = 0;
  
  if (currentProjectForBal && state.currentUser) {
    projectReceived = (currentProjectForBal.advanceHistory || [])
      .filter(a => a.userId === state.currentUser!.id)
      .reduce((sum, a) => sum + a.amount, 0);

    projectSpent = (currentProjectForBal.expenseItems || [])
      .filter(e => e.paidBy === 'petty_cash' && e.submittedById === state.currentUser!.id && e.status !== 'Rejected')
      .reduce((sum, e) => sum + e.amount, 0);
  }
  const projectBalance = projectReceived - projectSpent;

  // Initialize selected project correctly
  React.useEffect(() => {
    const isValid = availableProjects.some((p) => p.id === selectedProjectIdForEntry);
    if (!isValid && availableProjects.length > 0) {
      if (state.selectedProjectId && availableProjects.some((p) => p.id === state.selectedProjectId)) {
        setSelectedProjectIdForEntry(state.selectedProjectId);
      } else {
        setSelectedProjectIdForEntry(availableProjects[0].id);
      }
    }
  }, [
    selectedProjectIdForEntry,
    availableProjects,
    state.selectedProjectId,
  ]);

  if (availableProjects.length === 0) {
    return (
      <div className="px-4 md:px-8 py-12 max-w-4xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {state.language === "hi" ? "कोई प्रोजेक्ट नहीं मिला" : "No Projects Assigned"}
        </h2>
        <p className="text-slate-500 max-w-md">
          {state.language === "hi"
            ? "आपको अभी तक किसी भी प्रोजेक्ट पर असाइन नहीं किया गया है। कृपया अपने एडमिन से संपर्क करें।"
            : "You have not been assigned to any projects yet. Please contact your administrator."}
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-2 md:py-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-40">
      {isOffline && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-amber-700">
            <WifiOff className="w-5 h-5 shrink-0" />
            <p className="text-sm font-bold">
              {state.language === "hi"
                ? "आप ऑफ़लाइन हैं"
                : "You are currently offline."}
            </p>
          </div>
          <p className="text-xs text-amber-600 hidden sm:block">
            {state.language === "hi"
              ? "एंट्री सेव की जाएंगी और ऑनलाइन होने पर सिंक होंगी।"
              : "Entries will be saved locally and synced when online."}
          </p>
        </div>
      )}

      {showProjectSelector && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-800">
              {state.language === "hi"
                ? "प्रोजेक्ट चुनें (Assign Entry to Project)"
                : "Assign Entry to Project"}
            </h3>
            {isAdminOrOffice ? (
              <p className="text-xs text-slate-500">
                {state.language === "hi"
                  ? "आप किसी भी प्रोजेक्ट में एंट्री कर सकते हैं।"
                  : `As ${state.currentRole}, you can log expenses for any active project.`}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                {state.language === "hi"
                  ? "आप कई प्रोजेक्ट से जुड़े हैं। वर्तमान प्रोजेक्ट चुनें।"
                  : "You are assigned to multiple projects. Select the current project."}
              </p>
            )}
          </div>
          <div className="w-full md:w-64">
            <select
              value={selectedProjectIdForEntry}
              onChange={(e) => setSelectedProjectIdForEntry(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm font-bold text-slate-800 outline-none focus:border-amber-500"
            >
              <option value="" disabled>
                {state.language === "hi" ? "प्रोजेक्ट चुनें" : "Select Project"}
              </option>
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Lock Notification (Mock) */}
      {!isAdminOrOffice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900">
              {state.language === "hi"
                ? "अप्रूवल नियम (Approval Policy)"
                : "Approval Policy"}
            </h4>
            <p className="text-xs text-blue-700 mt-1">
              {state.language === "hi"
                ? "यहाँ दर्ज किया गया डेटा अप्रूव होने के बाद लॉक हो जाता है। उसके बाद केवल एडमिन या ऑफिस स्टाफ ही सुधार कर सकते हैं।"
                : "Data entered here is locked for editing once approved. Only Admin or Office Staff can make corrections later."}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-100 p-1 flex overflow-x-auto rounded-xl border border-slate-200 no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 md:px-6 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap shrink-0",
                isActive
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50",
              )}
            >
              <Icon
                className={cn("w-4 h-4", isActive ? "text-amber-500" : "")}
              />
              {t(tab.id) || tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-white border text-left border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {activeTab === "material" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Material Received / Consumed
              </h3>
              <p className="text-sm text-slate-500">
                Log cement bags, bricks, sand, aggregate, sariya etc.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 block">
                  {state.language === "hi"
                    ? "एंट्री टाइप (Entry Type)"
                    : "Entry Type"}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 bg-emerald-50 px-4 py-3 sm:py-2 border border-emerald-200 rounded-lg cursor-pointer justify-center">
                    <input
                      type="radio"
                      name="entry_type"
                      checked={materialForm.entryType === "received"}
                      onChange={() =>
                        setMaterialForm({
                          ...materialForm,
                          entryType: "received",
                        })
                      }
                      className="accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-emerald-800">
                      {state.language === "hi"
                        ? "प्राप्त हुआ (Received)"
                        : "Received (Chalaan)"}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 bg-orange-50 px-4 py-3 sm:py-2 border border-orange-200 rounded-lg cursor-pointer justify-center">
                    <input
                      type="radio"
                      name="entry_type"
                      checked={materialForm.entryType === "consumed"}
                      onChange={() =>
                        setMaterialForm({
                          ...materialForm,
                          entryType: "consumed",
                        })
                      }
                      className="accent-orange-600"
                    />
                    <span className="text-sm font-medium text-orange-800">
                      {state.language === "hi"
                        ? "खपत/इस्तेमाल (Consumed)"
                        : "Consumed (Site View)"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Date Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi" ? "तारीख (Date)" : "Entry Date"}
                </label>
                <input
                  type="date"
                  value={materialForm.date}
                  onChange={(e) =>
                    setMaterialForm({
                      ...materialForm,
                      date: e.target.value,
                    })
                  }
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "सामग्री का प्रकार (Material Type)"
                    : "Material Type"}
                </label>
                <select
                  value={materialForm.itemName}
                  onChange={(e) => {
                    const selectedItem = e.target.value;
                    let defaultUnit = "Bags";
                    const norm = selectedItem.toLowerCase();
                    if (
                      norm.includes("sand") ||
                      norm.includes("morang") ||
                      norm.includes("aggregate") ||
                      norm.includes("gsb")
                    ) {
                      defaultUnit = "CuFt";
                    } else if (
                      norm.includes("sariya") ||
                      norm.includes("taar")
                    ) {
                      defaultUnit = "Kg";
                    } else if (
                      norm.includes("brick") ||
                      norm.includes("pipe")
                    ) {
                      defaultUnit = "Numbers";
                    }
                    setMaterialForm({
                      ...materialForm,
                      itemName: selectedItem,
                      unit: defaultUnit,
                      customConversionFactor: "",
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                >
                  <option value="" disabled hidden>
                    {state.language === "hi"
                      ? "यहाँ से चुनिए..."
                      : "Select from here..."}
                  </option>
                  <option value="Cement">
                    {state.language === "hi" ? "सीमेंट (Cement)" : "Cement"}
                  </option>
                  <option value="GSB (Aggregate)">
                    {state.language === "hi"
                      ? "जीएसबी (GSB Aggregate)"
                      : "GSB (Aggregate)"}
                  </option>
                  <option value="20MM (Paun Inchi Aggregate)">
                    {state.language === "hi"
                      ? "20MM गिट्टी (Paun Inchi)"
                      : "20MM (Paun Inchi Aggregate)"}
                  </option>
                  <option value="Morang">
                    {state.language === "hi" ? "मौरंग (Morang)" : "Morang"}
                  </option>
                  <option value="Sada Balu (White Sand)">
                    {state.language === "hi"
                      ? "सफ़ेद बालू (White Sand)"
                      : "Sada Balu (White Sand)"}
                  </option>
                  <option value="Sariya (Rebar)">
                    {state.language === "hi"
                      ? "सरिया (Rebar)"
                      : "Sariya (Rebar)"}
                  </option>
                  <option value="Taar (Binding Wire)">
                    {state.language === "hi"
                      ? "बाइंडिंग तार (Binding Wire)"
                      : "Taar (Binding Wire)"}
                  </option>
                  <option value="Bricks">
                    {state.language === "hi" ? "ईंटें (Bricks)" : "Bricks"}
                  </option>
                  <option value="Pipe & Fittings">
                    {state.language === "hi"
                      ? "पाइप और फिटिंग (Pipe & Fittings)"
                      : "Pipe & Fittings"}
                  </option>
                  <option value="Other">
                    {state.language === "hi"
                      ? "अन्य (Custom)"
                      : "Other (Custom)"}
                  </option>
                </select>
              </div>

              {materialForm.itemName === "Other" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    {state.language === "hi"
                      ? "कस्टम सामग्री का नाम (Custom Material)"
                      : "Custom Material Name"}
                  </label>
                  <input
                    type="text"
                    placeholder="Enter material name..."
                    value={materialForm.customItem}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        customItem: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "विवरण (Description)"
                    : "Description / Details (Thickness, Grade)"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 2 soot, 3 soot, Class A..."
                    value={materialForm.description}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 outline-none focus:border-amber-500"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('materialForm.description', (text) => setMaterialForm(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text })))}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors",
                      isListening && activeSpeechField === 'materialForm.description' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {materialForm.entryType === "received"
                    ? state.language === "hi"
                      ? "मात्रा (वेंडर/बिल के अनुसार)"
                      : "Billed Quantity (As per Vendor/Bill)"
                    : state.language === "hi"
                      ? "खपत मात्रा (Measured Quantity)"
                      : "Quantity Consumed"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={materialForm.quantity}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        quantity: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                  />
                  <select
                    value={materialForm.unit}
                    onChange={(e) =>
                      setMaterialForm({
                        ...materialForm,
                        unit: e.target.value,
                        customConversionFactor: "",
                      })
                    }
                    className="w-36 bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                  >
                    <option>Bags</option>
                    <option>CuFt</option>
                    <option>Cubic M</option>
                    <option>Tons (MT)</option>
                    <option value="Quintal">
                      {state.language === "hi"
                        ? "क्विंटल (Quintal)"
                        : "Quintal"}
                    </option>
                    <option value="Trolley">
                      {state.language === "hi" ? "ट्रॉली (Trolley)" : "Trolley"}
                    </option>
                    <option value="Piece">
                      {state.language === "hi" ? "पीस (Piece)" : "Piece"}
                    </option>
                    <option>Kg</option>
                    <option>Numbers</option>
                    <option>Brass</option>
                    <option>Lot/Bill</option>
                  </select>
                </div>
              </div>

              {materialForm.entryType === "received" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    {state.language === "hi"
                      ? "दर प्रति यूनिट (Rate) (वेंडर/बिल के अनुसार) (वैकल्पिक)"
                      : "Rate / Unit (₹) (As per Vendor/Bill) (Optional)"}
                  </label>
                  <input
                    type="number"
                    placeholder="Rate..."
                    value={materialForm.rate}
                    onChange={(e) =>
                      setMaterialForm({ ...materialForm, rate: e.target.value })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500 no-spinners"
                  />
                </div>
              )}

              {materialForm.entryType === "received" &&
                materialForm.quantity &&
                materialForm.rate && (
                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 font-semibold">
                        {state.language === "hi"
                          ? "मानक यूनिट (Standard Unit)"
                          : "Standard Unit"}
                      </span>
                      <span className="font-bold text-slate-800 font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-slate-100">
                        {conversionInfo.standardUnit}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-amber-200/50">
                      <div>
                        <span className="text-xs text-slate-500 block font-medium mb-0.5">
                          {state.language === "hi"
                            ? "गणना की गई मात्रा (Standard Qty)"
                            : "Standard Qty"}
                        </span>
                        <span className="font-bold text-slate-900 text-base font-mono">
                          {calculatedStandardQty
                            .toFixed(2)
                            .replace(/\.00$/, "")}{" "}
                          {conversionInfo.standardUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-500 block font-medium mb-0.5">
                          {state.language === "hi"
                            ? "गणना की गई दर (Standard Rate)"
                            : "Standard Rate"}
                        </span>
                        <span className="font-bold text-slate-900 text-base font-mono">
                          ₹
                          {calculatedStandardRate.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          / {conversionInfo.standardUnit}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm pt-2.5 border-t border-amber-200/50">
                      <span className="text-slate-600 font-semibold">
                        {state.language === "hi"
                          ? "कुल राशि (Total Amount)"
                          : "Total Amount"}
                      </span>
                      <span className="font-black text-amber-950 text-lg font-mono">
                        ₹
                        {totalAmount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {conversionInfo.standardUnit !== materialForm.unit && (
                      <div className="pt-3 border-t border-amber-200/50 space-y-2">
                        <label className="text-xs font-semibold text-slate-600 block">
                          {state.language === "hi"
                            ? `कन्वर्शन फैक्टर एडजस्ट करें (1 ${materialForm.unit} = )`
                            : `Adjust Conversion Factor (1 ${materialForm.unit} = )`}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="any"
                            value={
                              materialForm.customConversionFactor !== ""
                                ? materialForm.customConversionFactor
                                : conversionInfo.defaultFactor
                            }
                            onChange={(e) =>
                              setMaterialForm({
                                ...materialForm,
                                customConversionFactor: e.target.value,
                              })
                            }
                            className="bg-white border border-amber-300 rounded-lg p-2 text-slate-800 outline-none focus:border-amber-500 text-xs w-24 font-mono font-bold"
                          />
                          <span className="text-xs text-slate-600 font-medium font-mono">
                            {conversionInfo.standardUnit}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setMaterialForm({
                                ...materialForm,
                                customConversionFactor: "",
                              })
                            }
                            className="text-[10px] text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded font-semibold transition"
                          >
                            {state.language === "hi"
                              ? "डिफ़ॉल्ट सेट करें"
                              : "Reset to Default"}
                          </button>
                        </div>
                        <p className="text-[10px] text-amber-700 italic leading-relaxed">
                          {state.language === "hi"
                            ? `*डिफ़ॉल्ट रूप से 1 ${materialForm.unit} = ${conversionInfo.defaultFactor} ${conversionInfo.standardUnit} माना गया है।`
                            : `*By default, 1 ${materialForm.unit} = ${conversionInfo.defaultFactor} ${conversionInfo.standardUnit} is used.`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

              {materialForm.entryType === "received" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      {state.language === "hi"
                        ? "दुकानदार का नाम (Vendor Info)"
                        : "Vendor / Shop Name"}
                    </label>
                    <input
                      type="text"
                      placeholder="Vendor Name..."
                      value={materialForm.vendor}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          vendor: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      {state.language === "hi"
                        ? "वाहन नंबर (Vehicle Number)"
                        : "Vehicle Number"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UP 32 XX 1234..."
                      value={materialForm.vehicleNo}
                      onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          vehicleNo: e.target.value,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-slate-400" />
                {state.language === "hi"
                  ? "फोटो / बिल (वैकल्पिक)"
                  : "Photo / Bill (Optional)"}
              </label>
              <div className="flex w-full">
                <button
                  type="button"
                  onClick={() => openLiveCamera((base64) => setMaterialForm((prev) => ({ ...prev, photo: base64 })))}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3 rounded-xl border border-amber-200 text-sm font-semibold transition-colors"
                >
                  <Camera className="w-4 h-4" /> Live Camera
                </button>
              </div>
              {materialForm.photo && (
                <div className="relative inline-block mt-4">
                  <button
                    onClick={() =>
                      setMaterialForm({ ...materialForm, photo: "" })
                    }
                    className="absolute -top-2 -right-2 bg-white text-rose-500 rounded-full border border-slate-200 shadow-sm p-1 z-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img
                    src={materialForm.photo}
                    alt="Bill proof"
                    className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "logistics" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Local Shifting
              </h3>
              <p className="text-sm text-slate-500">
                Record tractor/auto trips from drop point to site.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              {/* Date Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi" ? "तारीख (Date)" : "Entry Date"}
                </label>
                <input
                  type="date"
                  value={logisticsForm.date}
                  onChange={(e) =>
                    setLogisticsForm({
                      ...logisticsForm,
                      date: e.target.value,
                    })
                  }
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "वाहन का प्रकार (Vehicle Type)"
                    : "Vehicle Type"}
                </label>
                <select
                  value={logisticsForm.vehicleType}
                  onChange={(e) =>
                    setLogisticsForm({
                      ...logisticsForm,
                      vehicleType: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                >
                  <option>Tractor Trolley</option>
                  <option>DCM Mini Truck</option>
                  <option>Loader Auto</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "शिफ्टर / गाड़ी मालिक का नाम (Shifter Name)"
                    : "Shifter / Vehicle Owner Name"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={logisticsForm.shifterName}
                    onChange={(e) =>
                      setLogisticsForm({
                        ...logisticsForm,
                        shifterName: e.target.value,
                      })
                    }
                    placeholder={
                      state.language === "hi"
                        ? "शिफ्टर/ट्रांसपोर्टर का नाम दर्ज करें"
                        : "Enter shifter/transporter name..."
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 outline-none focus:border-amber-500"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('logisticsForm.shifterName', (text) => setLogisticsForm(prev => ({ ...prev, shifterName: prev.shifterName ? `${prev.shifterName} ${text}` : text })))}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors",
                      isListening && activeSpeechField === 'logisticsForm.shifterName' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "सामग्री शिफ्ट की गई (Material Shifted)"
                    : "Material Shifted"}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={logisticsForm.materialShifted}
                    onChange={(e) =>
                      setLogisticsForm({
                        ...logisticsForm,
                        materialShifted: e.target.value,
                      })
                    }
                    placeholder="e.g. Mixed aggregate"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 outline-none focus:border-amber-500"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('logisticsForm.materialShifted', (text) => setLogisticsForm(prev => ({ ...prev, materialShifted: prev.materialShifted ? `${prev.materialShifted} ${text}` : text })))}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors",
                      isListening && activeSpeechField === 'logisticsForm.materialShifted' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "प्रति चक्कर रेट (Rate per Trip)"
                    : "Rate per Trip (Chakkar)"}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={logisticsForm.ratePerTrip}
                    onChange={(e) =>
                      setLogisticsForm({
                        ...logisticsForm,
                        ratePerTrip: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="400"
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-amber-500 no-spinners"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "कुल चक्कर (Total Trips)"
                    : "Total Trips Done"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={logisticsForm.totalTrips}
                  onChange={(e) =>
                    setLogisticsForm({
                      ...logisticsForm,
                      totalTrips: e.target.value,
                    })
                  }
                  placeholder="5"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div className="bg-slate-100 rounded-lg p-4 flex justify-between items-center border border-slate-200">
              <span className="font-semibold text-slate-600">
                Calculated Booking Amount
              </span>
              <span className="text-xl font-bold text-slate-900">
                ₹{" "}
                {(
                  Math.max(0, Number(logisticsForm.ratePerTrip)) *
                  Math.max(0, Number(logisticsForm.totalTrips))
                ).toLocaleString()}
              </span>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-slate-400" />
                {state.language === "hi"
                  ? "फोटो / बिल (वैकल्पिक)"
                  : "Photo / Bill (Optional)"}
              </label>
              <div className="flex w-full">
                <button
                  type="button"
                  onClick={() => openLiveCamera((base64) => setLogisticsForm((prev) => ({ ...prev, photo: base64 })))}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3 rounded-xl border border-amber-200 text-sm font-semibold transition-colors"
                >
                  <Camera className="w-4 h-4" /> Live Camera
                </button>
              </div>
              {logisticsForm.photo && (
                <div className="relative inline-block mt-4">
                  <button
                    onClick={() =>
                      setLogisticsForm({ ...logisticsForm, photo: "" })
                    }
                    className="absolute -top-2 -right-2 bg-white text-rose-500 rounded-full border border-slate-200 shadow-sm p-1 z-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img
                    src={logisticsForm.photo}
                    alt="Bill proof"
                    className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "labor" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Daily Attendance
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium text-slate-600">
                    Date:
                  </span>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                    disabled={
                      state.currentRole !== "Admin" &&
                      state.currentRole !== "Super Admin"
                    }
                    className="border border-slate-300 rounded p-1 text-sm outline-none focus:border-amber-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>
              </div>
              <button
                onClick={() => setNewLaborModal(true)}
                className="text-sm font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200 shrink-0 self-start md:self-auto"
              >
                + New Labor
              </button>
            </div>

            {newLaborModal && (
              <div className="p-4 border border-slate-200 bg-white rounded-xl shadow-sm mb-4">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-sm text-slate-800">
                    Add New Labor worker
                  </h4>
                  <button
                    onClick={() => setNewLaborModal(false)}
                    className="text-slate-500 hover:bg-slate-100 rounded-full w-8 h-8 flex items-center justify-center font-bold text-xl"
                  >
                    &times;
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex justify-center mb-2">
                    <button
                      type="button"
                      onClick={() => openLiveCamera((base64) => setNewLaborForm((prev) => ({ ...prev, photo: base64 })))}
                      className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer flex-col gap-1 relative overflow-hidden focus:outline-none focus:border-amber-500"
                    >
                      {newLaborForm.photo ? (
                        <img
                          src={newLaborForm.photo}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-slate-400" />
                          <span className="text-[10px] text-slate-500 font-medium tracking-tight">
                            Add Photo
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">
                      {state.language === "hi"
                        ? "मज़दूर का नाम (Worker Name) *"
                        : "Worker Name *"}
                    </label>
                    <input
                      type="text"
                      placeholder="Worker Name"
                      value={newLaborForm.name}
                      onChange={(e) =>
                        setNewLaborForm({
                          ...newLaborForm,
                          name: e.target.value,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">
                      {state.language === "hi"
                        ? "मोबाइल नंबर (Mobile Number)"
                        : "Mobile Number"}
                    </label>
                    <input
                      type="tel"
                      placeholder="Mobile Number"
                      value={newLaborForm.phone}
                      onChange={(e) =>
                        setNewLaborForm({
                          ...newLaborForm,
                          phone: e.target.value,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">
                      {state.language === "hi"
                        ? "भूमिका (Role / Category) *"
                        : "Role / Category *"}
                    </label>
                    <select
                      value={newLaborForm.type}
                      onChange={(e) =>
                        setNewLaborForm({
                          ...newLaborForm,
                          type: e.target.value,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full bg-white"
                    >
                      <option>Mistri</option>
                      <option>Helper</option>
                      <option>Plumber</option>
                      <option>Painter</option>
                      <option>Electrician</option>
                      <option>Other</option>
                    </select>
                  </div>

                  {newLaborForm.type === "Other" ? (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">
                        Specify Role *
                      </label>
                      <input
                        type="text"
                        placeholder="Specify Role"
                        value={newLaborForm.customType}
                        onChange={(e) =>
                          setNewLaborForm({
                            ...newLaborForm,
                            customType: e.target.value,
                          })
                        }
                        className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">
                        Daily Rate (₹) *
                      </label>
                      <input
                        type="number"
                        placeholder="Daily Rate"
                        value={newLaborForm.rate}
                        onChange={(e) =>
                          setNewLaborForm({
                            ...newLaborForm,
                            rate: e.target.value,
                          })
                        }
                        className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                      />
                    </div>
                  )}

                  {newLaborForm.type === "Other" && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 mb-1 block">
                        Daily Rate (₹) *
                      </label>
                      <input
                        type="number"
                        placeholder="Daily Rate"
                        value={newLaborForm.rate}
                        onChange={(e) =>
                          setNewLaborForm({
                            ...newLaborForm,
                            rate: e.target.value,
                          })
                        }
                        className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1 block">
                      {state.language === "hi"
                        ? "पता / गाँव (Address) (Optional)"
                        : "Address / Village (Optional)"}
                    </label>
                    <input
                      type="text"
                      placeholder="Address"
                      value={newLaborForm.address}
                      onChange={(e) =>
                        setNewLaborForm({
                          ...newLaborForm,
                          address: e.target.value,
                        })
                      }
                      className="border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:border-amber-500 w-full"
                    />
                  </div>

                  <div className="mt-2">
                    <button
                      onClick={() => {
                        if (!newLaborForm.name || !newLaborForm.rate)
                          return addToast(
                            "Name and Rate are required",
                            "error",
                          );
                        if (
                          newLaborForm.type === "Other" &&
                          !newLaborForm.customType
                        )
                          return addToast(
                            "Please specify custom role",
                            "error",
                          );
                        if (!selectedProjectIdForEntry)
                          return addToast("Select Project First", "error");
                        const newLabor = {
                          id: `labor-${Date.now()}`,
                          name: newLaborForm.name,
                          type: newLaborForm.type,
                          customType: newLaborForm.customType,
                          rate: Number(newLaborForm.rate),
                          phone: newLaborForm.phone,
                          address: newLaborForm.address,
                          photo: newLaborForm.photo,
                          attendance: [],
                          status: "",
                          advance: "",
                          createdBy: state.currentUser?.id,
                          approvalStatus: isAutoApproved ? 'Approved' as const : 'Pending Approval' as const
                        };
                        const project = state.projects.find(
                          (p) => p.id === selectedProjectIdForEntry,
                        );
                        if (project) {
                          updateProject(project.id, {
                            labors: [...(project.labors || []), newLabor],
                          });
                          addToast(
                            isAutoApproved
                              ? `${state.language === 'hi' ? 'नया मजदूर सफलतापूर्वक सहेजा गया!' : 'New Labor Worker saved successfully!'}`
                              : `${state.language === 'hi' ? 'नया मजदूर सहेजा गया और एडमिन की मंजूरी का इंतजार है!' : 'New Labor Worker saved and pending Admin approval!'}`,
                            "success"
                          );
                        }
                        setNewLaborModal(false);
                        setNewLaborForm({
                          name: "",
                          type: "Mistri",
                          customType: "",
                          rate: "",
                          phone: "",
                          address: "",
                          photo: "",
                        });
                      }}
                      className="w-full bg-slate-900 text-white p-3 font-bold text-sm rounded-lg shadow-sm hover:bg-slate-800 transition-colors"
                    >
                      Save New Labor
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {laborList.length === 0 ? (
                <p className="text-sm text-slate-500 p-4 border border-dashed rounded-xl text-center flex items-center justify-center h-24">
                  No labor added to this site yet. Add a new labor to get
                  started.
                </p>
              ) : null}

              {laborList.filter((l) => l.isArchived).length > 0 && (
                <div className="flex justify-end mb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showArchivedLabors}
                      onChange={(e) => setShowArchivedLabors(e.target.checked)}
                      className="rounded text-amber-500 focus:ring-amber-500"
                    />
                    Show Deactivated Labors
                  </label>
                </div>
              )}

              {laborList
                .filter((l) => showArchivedLabors || !l.isArchived)
                .map((labor, i) => {
                  const isExpanded =
                    isHistoryOpen &&
                    newLaborModal === false &&
                    selectedProjectIdForEntry === labor.id; // Optional state for expansion
                  const totalPresent =
                    labor.attendance?.filter((a) => a.status === "P").length ||
                    0;
                  const totalAbsent =
                    labor.attendance?.filter((a) => a.status === "A").length ||
                    0;
                  const presentText = `${totalPresent} P`;
                  const absentText = `${totalAbsent} A`;

                  const isPending = labor.approvalStatus === 'Pending Approval';
                  const origLabor = state.projects.find(p => p.id === selectedProjectIdForEntry)?.labors?.find(l => l.id === labor.id);
                  const isAttendanceAlreadyMarked = origLabor?.attendance?.some(a => a.date === attendanceDate);
                  const isAttendanceLocked = isAttendanceAlreadyMarked && state.currentRole !== 'Admin' && state.currentRole !== 'Super Admin';

                  return (
                    <div
                      key={labor.id}
                      className={cn(
                        "flex flex-col border rounded-xl overflow-hidden shadow-sm transition-all",
                        isPending ? "border-amber-300 bg-amber-50/30" : "border-slate-200 bg-white"
                      )}
                    >
                      {/* Main row */}
                      <div className="p-4 flex flex-col gap-3">
                        <div className="flex flex-col min-w-0">
                          <div className="flex flex-row items-start justify-between mb-1 gap-2">
                            <p className="font-bold text-slate-800 break-words text-base md:text-lg leading-tight flex-1 min-w-0 pr-2 flex items-center gap-2">
                              {labor.name}
                              {isPending && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Pending Approval</span>
                              )}
                            </p>
                            <p className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                              {labor.type === "Other"
                                ? labor.customType
                                : labor.type}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-amber-600 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded shadow-sm">
                              ₹{labor.rate}/day
                            </span>
                            {labor.phone && (
                              <span className="font-medium truncate">
                                {labor.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-4 pt-3 border-t border-slate-100">
                          <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0 shadow-inner mt-0.5">
                            {labor.photo ? (
                              <img
                                src={labor.photo}
                                alt={labor.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Users className="w-6 h-6 text-slate-400" />
                            )}
                          </div>

                          <div className="flex flex-col gap-2 flex-1 min-w-0 max-w-[240px]">
                            <div className={cn("flex bg-slate-100 rounded-lg overflow-hidden shrink-0 shadow-sm border border-slate-200 h-10 w-full", (isPending || isAttendanceLocked) && "opacity-50 pointer-events-none")}>
                              <button
                                onClick={() => {
                                  const newLabors = [...laborList];
                                  const idx = newLabors.findIndex(
                                    (l) => l.id === labor.id,
                                  );
                                  if (idx > -1)
                                    newLabors[idx].status =
                                      newLabors[idx].status === "P" ? "" : "P";
                                  setLaborList(newLabors);
                                }}
                                className={cn(
                                  "flex-1 text-sm font-bold border-r border-slate-200 transition-colors flex items-center justify-center gap-1",
                                  labor.status === "P"
                                    ? "bg-emerald-500 text-white"
                                    : "bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-700",
                                )}
                              >
                                {labor.status === "P" && (
                                  <FileCheck2 className="w-4 h-4 hidden md:block" />
                                )}
                                P
                              </button>
                              <button
                                onClick={() => {
                                  const newLabors = [...laborList];
                                  const idx = newLabors.findIndex(
                                    (l) => l.id === labor.id,
                                  );
                                  if (idx > -1)
                                    newLabors[idx].status =
                                      newLabors[idx].status === "H" ? "" : "H";
                                  setLaborList(newLabors);
                                }}
                                className={cn(
                                  "flex-1 text-sm font-bold border-r border-slate-200 transition-colors flex items-center justify-center gap-1",
                                  labor.status === "H"
                                    ? "bg-blue-500 text-white"
                                    : "bg-white text-slate-500 hover:bg-blue-50 hover:text-blue-700",
                                )}
                              >
                                {labor.status === "H" && (
                                  <FileCheck2 className="w-3 h-3 hidden md:block" />
                                )}
                                H
                              </button>
                              <button
                                onClick={() => {
                                  const newLabors = [...laborList];
                                  const idx = newLabors.findIndex(
                                    (l) => l.id === labor.id,
                                  );
                                  if (idx > -1)
                                    newLabors[idx].status =
                                      newLabors[idx].status === "A" ? "" : "A";
                                  setLaborList(newLabors);
                                }}
                                className={cn(
                                  "flex-1 text-sm font-bold transition-colors flex items-center justify-center",
                                  labor.status === "A"
                                    ? "bg-red-500 text-white"
                                    : "bg-white text-slate-500 hover:bg-red-50 hover:text-red-700",
                                )}
                              >
                                A
                              </button>
                            </div>

                            <input
                              type="number"
                              placeholder="Adv. ₹"
                              className="border border-slate-200 px-3 py-2 text-sm w-full h-10 outline-none focus:border-amber-500 bg-white rounded-lg transition-colors font-medium text-slate-900 text-center disabled:opacity-50 disabled:bg-slate-50"
                              value={labor.advance}
                              disabled={isPending || isAttendanceLocked}
                              onChange={(e) => {
                                const newLabors = [...laborList];
                                const idx = newLabors.findIndex(
                                  (l) => l.id === labor.id,
                                );
                                if (idx > -1)
                                  newLabors[idx].advance = e.target.value;
                                setLaborList(newLabors);
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Quick History Bar */}
                      <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs gap-3">
                        <p className="font-semibold text-slate-600 flex items-center gap-1">
                          <History className="w-3.5 h-3.5" /> History:
                        </p>
                        <div className="flex items-center gap-4">
                          <p className="text-slate-500 font-medium">
                            <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {presentText}
                            </span>{" "}
                            <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded ml-1">
                              {absentText}
                            </span>
                          </p>
                          <div className="flex gap-4">
                          <button
                            onClick={async () => {
                              if (state.currentRole === "Office Staff") {
                                const reason = await prompt(`Reason to ${labor.isArchived ? 'activate' : 'deactivate'} this labor?`);
                                if (!reason) return addToast('Reason is required', 'error');
                                addApprovalRequest({
                                  projectId: selectedProjectIdForEntry,
                                  module: "Labor",
                                  recordId: labor.id,
                                  action: "Edit",
                                  requestedBy: state.currentUser?.name || "Unknown",
                                  requestedById: state.currentUser?.id || "unknown",
                                  requestedByRole: state.currentRole,
                                  itemName: labor.name,
                                  newData: { isArchived: !labor.isArchived },
                                  reason: "REQUESTED BY OFFICE STAFF: " + reason
                                });
                                addToast(`${labor.isArchived ? 'Activate' : 'Deactivate'} request sent to Admin`, 'success');
                                return;
                              }

                              if (
                                await confirm(
                                  `Are you sure you want to ${labor.isArchived ? "activate" : "deactivate"} ${labor.name}?`,
                                )
                              ) {
                                const project = state.projects.find(
                                  (p) => p.id === selectedProjectIdForEntry,
                                );
                                if (project && project.labors) {
                                  const updatedLabors = project.labors.map(
                                    (l) =>
                                      l.id === labor.id
                                        ? { ...l, isArchived: !l.isArchived }
                                        : l,
                                  );
                                  updateProject(project.id, {
                                    labors: updatedLabors,
                                  });
                                }
                              }
                            }}
                            className="text-slate-400 hover:text-red-600 transition-colors flex flex-row items-center gap-1 font-semibold"
                          >
                            <Power className="w-3.5 h-3.5" />{" "}
                            {labor.isArchived ? "Activate" : "Deactivate"}
                          </button>
                          
                          {(state.currentRole === "Super Admin" || state.currentRole === "Admin") && (
                            <button
                              onClick={async () => {
                                if (
                                  await confirm(
                                    `Are you sure you want to permanently delete ${labor.name}? This action cannot be undone.`,
                                  )
                                ) {
                                  const enteredPin = await prompt("Enter your Password to confirm deleting this labor:");
                                  if (enteredPin === null) return;
                                  
                                  try {
                                    const res = await window.fetch('/api/auth/login', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ phone: state.currentUser?.phone, pin: enteredPin })
                                    });
                                    
                                    if (!res.ok) {
                                      addToast("Incorrect Password.", "error");
                                      return;
                                    }
                                  } catch (err) {
                                    addToast("Failed to verify password.", "error");
                                    return;
                                  }

                                  const reason = await prompt("Please provide a reason for deleting this labor:");
                                  if (!reason) return;

                                  const project = state.projects.find(
                                    (p) => p.id === selectedProjectIdForEntry,
                                  );
                                  if (project && project.labors) {
                                    const updatedLabors = project.labors.filter((l) => l.id !== labor.id);
                                    
                                    addToRecycleBin({
                                      projectId: project.id,
                                      itemType: 'LaborMaster',
                                      itemName: labor.name,
                                      itemData: labor,
                                      deletedBy: state.currentUser?.name || 'Unknown',
                                      deleteReason: reason
                                    });

                                    updateProject(project.id, {
                                      labors: updatedLabors,
                                    });
                                    addToast(`Deleted labor ${labor.name} permanently.`, 'success');
                                  }
                                }
                              }}
                              className="text-slate-400 hover:text-red-600 transition-colors flex flex-row items-center gap-1 font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Machinery Tab */}
        {activeTab === "machinery" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800">
                Machinery Details
              </h3>
              <p className="text-sm text-slate-500">
                Record runtime and fuel for JCB, Roller, Mixture, and others.
              </p>
            </div>

            {/* Date Selector */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="text-sm font-medium text-slate-700">
                {state.language === "hi" ? "तारीख (Date)" : "Entry Date"}
              </label>
              <input
                type="date"
                value={machineryForm.date}
                onChange={(e) =>
                  setMachineryForm({
                    ...machineryForm,
                    date: e.target.value,
                  })
                }
                max={new Date().toISOString().split("T")[0]}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
              />
            </div>

            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Rented Machine
              </h4>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {state.language === "hi"
                      ? "मशीन का नाम (Machine Name)"
                      : "Machine Name"}
                  </label>
                  <select
                    value={machineryForm.machineName}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        machineName: e.target.value,
                      })
                    }
                    className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                  >
                    <option>JCB</option>
                    <option>Roller</option>
                    <option>Tandem Roller</option>
                    <option>Concrete Mixture</option>
                    <option>Fiori</option>
                    <option>Water Tanker (Pani Machine)</option>
                    <option>Motor / Pump</option>
                    <option>Other</option>
                  </select>
                </div>
                {machineryForm.machineName === "Other" && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      Custom Machine
                    </label>
                    <input
                      type="text"
                      value={machineryForm.customMachine}
                      onChange={(e) =>
                        setMachineryForm({
                          ...machineryForm,
                          customMachine: e.target.value,
                        })
                      }
                      className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {state.language === "hi"
                      ? "चार्ज का प्रकार (Charge Type)"
                      : "Charge Type"}
                  </label>
                  <select
                    value={machineryForm.chargeType}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        chargeType: e.target.value as any,
                      })
                    }
                    className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                  >
                    <option value="hourly">Per Hour</option>
                    <option value="daily">Per Day</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    Rate (
                    {machineryForm.chargeType === "hourly" ? "₹/Hr" : "₹/Day"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={machineryForm.rate}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        rate: e.target.value,
                      })
                    }
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    placeholder="e.g. 800"
                    className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none no-spinners"
                  />
                </div>
                {machineryForm.chargeType === "hourly" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">
                        Hours
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={machineryForm.workHoursOrDays}
                        onChange={(e) =>
                          setMachineryForm({
                            ...machineryForm,
                            workHoursOrDays: e.target.value,
                          })
                        }
                        placeholder="e.g. 8"
                        className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 block mb-1">
                        Minutes
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={machineryForm.workMinutes}
                        onChange={(e) =>
                          setMachineryForm({
                            ...machineryForm,
                            workMinutes: e.target.value,
                          })
                        }
                        placeholder="e.g. 22"
                        className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      {state.language === "hi"
                        ? "किया गया कार्य (दिन) - Work Done (Days)"
                        : "Work Done (Days)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={machineryForm.workHoursOrDays}
                      onChange={(e) =>
                        setMachineryForm({
                          ...machineryForm,
                          workHoursOrDays: e.target.value,
                        })
                      }
                      placeholder="e.g. 1"
                      className="w-full text-sm font-medium px-3 py-2 border border-slate-300 rounded bg-white outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg p-3 flex justify-between items-center border border-slate-200 mt-2">
                <span className="font-bold text-slate-600 text-sm">
                  Amount Booked
                </span>
                <span className="text-lg font-bold text-slate-900">
                  ₹{" "}
                  {(
                    (Number(machineryForm.rate) || 0) *
                    (machineryForm.chargeType === "hourly"
                      ? (Number(machineryForm.workHoursOrDays) || 0) +
                        (Number(machineryForm.workMinutes) || 0) / 60
                      : Number(machineryForm.workHoursOrDays) || 0)
                  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-500 block mb-1">
                  {state.language === "hi" ? "विवरण (Description)" : "Description / Purpose"}
                </label>
                <div className="relative">
                  <textarea
                    value={machineryForm.description}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="What work was done?"
                    className="w-full text-sm font-medium px-3 py-2 pr-10 border border-slate-300 rounded bg-white outline-none resize-none h-16"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('machineryForm.description', (text) => setMachineryForm(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text })))}
                    className={cn(
                      "absolute right-2 top-2 p-1.5 rounded-full transition-colors",
                      isListening && activeSpeechField === 'machineryForm.description' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-bold text-slate-800">
                Fuel Allocation (Diesel)
              </h4>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {state.language === "hi"
                      ? "पंप स्लिप राशि ₹ (Pump Slip Amount)"
                      : "Pump Slip Amount ₹"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={machineryForm.fuelSlipAmount}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        fuelSlipAmount: e.target.value,
                      })
                    }
                    placeholder="2500"
                    className="w-full text-sm border-slate-300 rounded bg-white px-3 py-2 border"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">
                    {state.language === "hi"
                      ? "भरे गए लीटर (Liters Filled)"
                      : "Liters Filled"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={machineryForm.litersFilled}
                    onChange={(e) =>
                      setMachineryForm({
                        ...machineryForm,
                        litersFilled: e.target.value,
                      })
                    }
                    placeholder="28.5L"
                    className="w-full text-sm border-slate-300 rounded bg-white px-3 py-2 border"
                  />
                </div>
                <div className="space-y-2 mt-4 pt-4 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-500 flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5" /> Meter or Slip Photo Proof (Optional)
                  </label>
                  <div className="flex w-full mt-1.5">
                    <button
                      type="button"
                      onClick={() => openLiveCamera((base64) => setMachineryForm((prev) => ({ ...prev, fuelPhoto: base64 })))}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 py-2 rounded-lg border border-amber-200 text-xs font-semibold transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5" /> Live Camera
                    </button>
                  </div>
                  {machineryForm.fuelPhoto && (
                    <div className="relative inline-block mt-2">
                      <button
                        onClick={() =>
                          setMachineryForm({ ...machineryForm, fuelPhoto: "" })
                        }
                        className="absolute -top-2 -right-2 bg-white text-rose-500 rounded-full border border-slate-200 shadow-sm p-1 z-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <img
                        src={machineryForm.fuelPhoto}
                        alt="Fuel proof"
                        className="h-20 w-20 object-cover rounded-lg border border-slate-200 shadow-sm"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Petty Cash */}
        {activeTab === "misc" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Petty Cash (Running Exp.)
                </h3>
                <p className="text-sm text-slate-500">
                  Water tankers, food, firewood, misc.
                </p>
              </div>
              {(state.currentUser?.role === "Munshi" ||
                state.currentUser?.role === "Site Incharge") && (
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-500 font-semibold uppercase tooltip" title="Balance for currently selected project">
                    {currentProjectForBal?.name || 'Project'} Balance
                  </p>
                  <p
                    className={cn(
                      "text-xl font-bold",
                      projectBalance < 0
                        ? "text-red-500"
                        : "text-emerald-600",
                    )}
                  >
                    ₹ {projectBalance.toLocaleString()}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-1 flex gap-2 justify-end">
                    <span>In: ₹{projectReceived.toLocaleString()}</span>
                    <span>Out: ₹{projectSpent.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Date Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi" ? "तारीख (Date)" : "Entry Date"}
                </label>
                <input
                  type="date"
                  value={miscForm.date}
                  onChange={(e) =>
                    setMiscForm({
                      ...miscForm,
                      date: e.target.value,
                    })
                  }
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "खर्च का विवरण (Expense Detail)"
                    : "Expense Detail (Voice Typing Supported)"}
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={miscForm.detail}
                    onChange={(e) =>
                      setMiscForm({ ...miscForm, detail: e.target.value })
                    }
                    placeholder="Mistry food and CC road curing tanker..."
                    className="w-full border-slate-200 border bg-slate-50 rounded-lg p-3 outline-none focus:border-amber-500 resize-none text-sm font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('miscForm.detail', (text) => setMiscForm(prev => ({ ...prev, detail: prev.detail ? `${prev.detail} ${text}` : text })))}
                    className={cn(
                      "absolute right-3 bottom-3 p-2 rounded-full transition-colors",
                      isListening && activeSpeechField === 'miscForm.detail' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "bg-slate-200 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi"
                    ? "भुगतान की गई राशि ₹ (Amount Paid)"
                    : "Amount Paid ₹"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={miscForm.amountPaid}
                  onChange={(e) =>
                    setMiscForm({ ...miscForm, amountPaid: e.target.value })
                  }
                  onWheel={(e) => (e.target as HTMLElement).blur()}
                  placeholder="850"
                  className="w-full text-lg font-bold border-slate-200 border bg-slate-50 rounded-lg p-3 outline-none focus:border-amber-500 no-spinners"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-slate-400" />
                  Bill / Photo Proof (Optional)
                </label>

                <div className="flex w-full">
                  <button
                    type="button"
                    onClick={() => openLiveCamera((base64) => setMiscForm((prev) => ({ ...prev, photo: base64 })))}
                    className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 hover:bg-amber-100 py-3 rounded-xl border border-amber-200 text-sm font-semibold transition-colors"
                  >
                    <Camera className="w-4 h-4" /> Live Camera
                  </button>
                </div>

                {miscForm.photo && (
                  <div className="relative inline-block mt-2">
                    <button
                      onClick={() => setMiscForm({ ...miscForm, photo: "" })}
                      className="absolute -top-2 -right-2 bg-white text-rose-500 rounded-full border border-slate-200 shadow-sm p-1 z-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <img
                      src={miscForm.photo}
                      alt="Bill proof"
                      className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "photos" && (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  {state.language === "hi" ? "साइट की तस्वीरें (Site Photos)" : "Site Photos"}
                </h3>
                <p className="text-sm text-slate-500">
                  {state.language === "hi"
                    ? "साइट से कोई भी फोटो या डॉक्यूमेंट अपलोड करें।"
                    : "Upload any photo or document from the site."}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Date Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  {state.language === "hi" ? "तारीख (Date)" : "Entry Date"}
                </label>
                <input
                  type="date"
                  value={photosForm.date}
                  onChange={(e) =>
                    setPhotosForm({
                      ...photosForm,
                      date: e.target.value,
                    })
                  }
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  {state.language === "hi" ? "फोटो / डॉक्यूमेंट (Photo / Doc)" : "Photo / Doc"}
                </label>
                <div className="flex w-full">
                  <button
                    type="button"
                    onClick={() => openLiveCamera((base64) => setPhotosForm((prev) => ({ ...prev, base64: base64 })))}
                    className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-amber-700"
                  >
                    <Camera className="w-8 h-8 mb-2" />
                    <span className="text-sm font-medium text-center">
                      {state.language === "hi"
                        ? "लाइव फोटो लें (GPS Stamped)"
                        : "Take Live Photo (GPS Stamped)"}
                    </span>
                  </button>
                </div>

                {photosForm.base64 && (
                  <div className="relative inline-block mt-4 w-full">
                    <button
                      onClick={() => setPhotosForm({ ...photosForm, file: null, base64: "" })}
                      className="absolute top-2 right-2 bg-white text-rose-500 rounded-full border border-slate-200 shadow-sm p-1.5 z-10 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {(!photosForm.file || photosForm.file.type.startsWith('image/')) ? (
                      <img
                        src={photosForm.base64}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div className="w-full h-48 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center">
                        <FileText className="w-12 h-12 text-slate-400" />
                        <span className="ml-2 text-slate-600">{photosForm.file?.name}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  {state.language === "hi" ? "श्रेणी (Category) *" : "Category *"}
                </label>
                <select 
                  value={photosForm.category}
                  onChange={(e) => setPhotosForm({ ...photosForm, category: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-800 outline-none focus:border-amber-500"
                >
                  <option value="Progress Photo">{state.language === "hi" ? "प्रगति तस्वीर" : "Progress Photo"}</option>
                  <option value="Before Work">{state.language === "hi" ? "काम से पहले" : "Before Work"}</option>
                  <option value="During Work">{state.language === "hi" ? "काम के दौरान" : "During Work"}</option>
                  <option value="After Completion">{state.language === "hi" ? "काम पूरा होने के बाद" : "After Completion"}</option>
                  <option value="Issue / Damage">{state.language === "hi" ? "समस्या / नुकसान" : "Issue / Damage"}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">
                  {state.language === "hi" ? "विवरण / रिमार्क्स (Remarks)" : "Remarks (Optional)"}
                </label>
                <div className="relative">
                  <textarea
                    maxLength={200}
                    placeholder={state.language === "hi" ? "फोटो के बारे में कुछ लिखें (Max 200 chars)..." : "Write something about the photo (Max 200 chars)..."}
                    value={photosForm.description}
                    onChange={(e) => setPhotosForm({ ...photosForm, description: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pr-10 text-slate-800 outline-none focus:border-amber-500 min-h-[100px]"
                  />
                  <button 
                    type="button"
                    onClick={() => startListening('photosForm.description', (text) => setPhotosForm(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text })))}
                    className={cn(
                      "absolute right-2 bottom-3 p-1.5 rounded-full transition-colors",
                      isListening && activeSpeechField === 'photosForm.description' 
                        ? "bg-red-100 text-red-600 animate-pulse" 
                        : "bg-slate-200 text-slate-400 hover:bg-amber-100 hover:text-amber-600"
                    )}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Status Selector for Applicable Tabs */}
        {["material", "logistics", "machinery", "misc", "labor"].includes(activeTab) &&
          !(
            activeTab === "material" && materialForm.entryType === "consumed"
          ) && (
            <div className="px-6 pb-6">
              <label className="text-sm font-medium text-slate-700 block mb-3">
                {state.language === "hi"
                  ? (activeTab === "labor" ? "अग्रिम भुगतान (Advance Payment)" : "भुगतान स्थिति (Payment Status)")
                  : (activeTab === "labor" ? "Advance Payment Status" : "Payment Status (Who paid for this?)")}
              </label>
              <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                {isAdminOrOffice ? (
                  <>
                    {/* Paid Option for Admin/Office Staff */}
                    <button
                      onClick={() => {
                        if (activeTab === "material")
                          setMaterialForm({ ...materialForm, paidBy: "office" });
                        if (activeTab === "logistics")
                          setLogisticsForm({
                            ...logisticsForm,
                            paidBy: "office",
                          });
                        if (activeTab === "machinery")
                          setMachineryForm({
                            ...machineryForm,
                            paidBy: "office",
                          });
                        if (activeTab === "misc")
                          setMiscForm({ ...miscForm, paidBy: "office" });
                        if (activeTab === "labor")
                          setLaborPaidBy("office");
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-md transition-all shadow-sm",
                        (activeTab === "material"
                          ? materialForm.paidBy
                          : activeTab === "logistics"
                            ? logisticsForm.paidBy
                            : activeTab === "machinery"
                              ? machineryForm.paidBy
                              : activeTab === "labor"
                                ? laborPaidBy
                                : miscForm.paidBy) === "office"
                          ? "bg-white text-blue-700 border border-blue-200"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {state.language === "hi"
                        ? "भुगतान किया (Paid)"
                        : "Paid"}
                    </button>

                    {/* Unpaid Option for Admin/Office Staff */}
                    {activeTab !== "labor" && (
                    <button
                      onClick={() => {
                        if (activeTab === "material")
                          setMaterialForm({ ...materialForm, paidBy: "unpaid" });
                        if (activeTab === "logistics")
                          setLogisticsForm({ ...logisticsForm, paidBy: "unpaid" });
                        if (activeTab === "machinery")
                          setMachineryForm({ ...machineryForm, paidBy: "unpaid" });
                        if (activeTab === "misc")
                          setMiscForm({ ...miscForm, paidBy: "unpaid" });
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-md transition-all shadow-sm",
                        (activeTab === "material"
                          ? materialForm.paidBy
                          : activeTab === "logistics"
                            ? logisticsForm.paidBy
                            : activeTab === "machinery"
                              ? machineryForm.paidBy
                              : miscForm.paidBy) === "unpaid"
                          ? "bg-white text-rose-700 border border-rose-200"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {state.language === "hi"
                        ? "बकाया (Unpaid)"
                        : "Unpaid"}
                    </button>
                    )}
                  </>
                ) : (
                  <>
                    {/* Paid by Me (Petty Cash) Option for Field Staff */}
                    <button
                      onClick={() => {
                        if (activeTab === "material")
                          setMaterialForm({
                            ...materialForm,
                            paidBy: "petty_cash",
                          });
                        if (activeTab === "logistics")
                          setLogisticsForm({
                            ...logisticsForm,
                            paidBy: "petty_cash",
                          });
                        if (activeTab === "machinery")
                          setMachineryForm({
                            ...machineryForm,
                            paidBy: "petty_cash",
                          });
                        if (activeTab === "misc")
                          setMiscForm({ ...miscForm, paidBy: "petty_cash" });
                        if (activeTab === "labor")
                          setLaborPaidBy("petty_cash");
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-md transition-all shadow-sm",
                        (activeTab === "material"
                          ? materialForm.paidBy
                          : activeTab === "logistics"
                            ? logisticsForm.paidBy
                            : activeTab === "machinery"
                              ? machineryForm.paidBy
                              : activeTab === "labor"
                                ? laborPaidBy
                                : miscForm.paidBy) === "petty_cash"
                          ? "bg-white text-emerald-700 border border-emerald-200"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {state.language === "hi"
                        ? "मैंने दिया (Petty Cash)"
                        : "Paid by Me (Petty Cash)"}
                    </button>

                    {activeTab === "labor" && (
                    <button
                      onClick={() => {
                        setLaborPaidBy("office");
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-md transition-all shadow-sm",
                        laborPaidBy === "office"
                          ? "bg-white text-blue-700 border border-blue-200"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {state.language === "hi"
                        ? "मालिक ने दिया (Owner Paid)"
                        : "Owner Paid"}
                    </button>
                    )}

                    {/* Unpaid Option for Field Staff */}
                    {activeTab !== "labor" && (
                    <button
                      onClick={() => {
                        if (activeTab === "material")
                          setMaterialForm({ ...materialForm, paidBy: "unpaid" });
                        if (activeTab === "logistics")
                          setLogisticsForm({ ...logisticsForm, paidBy: "unpaid" });
                        if (activeTab === "machinery")
                          setMachineryForm({ ...machineryForm, paidBy: "unpaid" });
                        if (activeTab === "misc")
                          setMiscForm({ ...miscForm, paidBy: "unpaid" });
                      }}
                      className={cn(
                        "flex-1 py-2 text-sm font-bold rounded-md transition-all shadow-sm",
                        (activeTab === "material"
                          ? materialForm.paidBy
                          : activeTab === "logistics"
                            ? logisticsForm.paidBy
                            : activeTab === "machinery"
                              ? machineryForm.paidBy
                              : miscForm.paidBy) === "unpaid"
                          ? "bg-white text-rose-700 border border-rose-200"
                          : "text-slate-500 hover:text-slate-700",
                      )}
                    >
                      {state.language === "hi"
                        ? "बकाया (Office Payout)"
                        : "Unpaid (Office to Pay)"}
                    </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        {/* Global Action Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row justify-end gap-3 rounded-b-xl">
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-slate-500 border border-slate-300 hover:bg-slate-200 transition-colors w-full sm:w-auto"
          >
            <History className="w-4 h-4" />{" "}
            {state.language === "hi"
              ? "इतिहास देखें (History)"
              : "View History"}
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              console.log("Save clicked!");
              if (!selectedProjectIdForEntry) {
                return addToast("Select a project first", "error");
              }
              if (activeTab === "material") handleMaterialSave();
              else if (activeTab === "logistics") handleLogisticsSave();
              else if (activeTab === "labor") handleLaborSave();
              else if (activeTab === "machinery") handleMachinerySave();
              else if (activeTab === "misc") handleMiscSave();
              else if (activeTab === "photos") handlePhotosSave();
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-slate-900 transition-colors shadow-sm bg-amber-400 hover:bg-amber-500 w-full sm:w-auto"
          >
            <Save className="w-4 h-4" />{" "}
            {state.language === "hi" ? "सेव करें (Save)" : "Save"}{" "}
            {activeTab === "misc"
              ? state.language === "hi"
                ? "नकद खर्च"
                : "Petty Cash"
              : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}{" "}
            {state.language === "hi" && activeTab !== "misc"
              ? "एंट्री"
              : "Entry"}
          </button>
        </div>
      </div>

      {isHistoryOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 flex flex-col justify-end">
          <div
            className="bg-white rounded-t-2xl max-h-[85vh] w-full max-w-md mx-auto flex flex-col animate-in slide-in-from-bottom flex-1"
            style={{ maxWidth: "400px" }}
          >
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="font-bold text-lg text-slate-800">
                Recent Entries (24h)
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-500 hover:text-slate-800 bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto w-full no-scrollbar">
              {state.projects
                .find((p) => p.id === selectedProjectIdForEntry)
                ?.expenseItems?.filter(
                  (e) => {
                    const isAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin' || state.currentRole === 'Office Staff';
                    const isMy = e.submittedById === state.currentUser?.id || e.submittedBy === state.currentUser?.name;
                    return (isAdmin || isMy) && e.status !== "Rejected";
                  }
                ).length ? (
                <div className="divide-y divide-slate-100 p-2 pb-12">
                  {[
                    ...(state.projects.find(
                      (p) => p.id === selectedProjectIdForEntry,
                    )?.expenseItems || []),
                  ]
                    .filter((e) => {
                      const isAdmin = state.currentRole === 'Admin' || state.currentRole === 'Super Admin' || state.currentRole === 'Office Staff';
                      const isMy = e.submittedById === state.currentUser?.id || e.submittedBy === state.currentUser?.name;
                      return (isAdmin || isMy) && e.status !== "Rejected";
                    })
                    .filter((e) => {
                      const isApproved = e.status === "Approved";
                      const hoursSinceEntry =
                        (new Date().getTime() - new Date(e.date).getTime()) /
                        (1000 * 3600);
                      return !isApproved || hoursSinceEntry < 24;
                    })
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime(),
                    )
                    .map((item) => (
                      <div key={item.id} className="p-3">
                        {editingLogId === item.id ? (
                          <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded-lg border border-blue-100">
                            <input
                              className="border p-1 w-full rounded text-sm"
                              value={editLogForm.itemName || ""}
                              onChange={(e) =>
                                setEditLogForm({
                                  ...editLogForm,
                                  itemName: e.target.value,
                                })
                              }
                              placeholder="Item Name"
                            />
                            <div className="flex gap-2">
                              <input
                                className="border p-1 w-1/2 rounded text-sm"
                                value={editLogForm.quantity || ""}
                                onChange={(e) =>
                                  setEditLogForm({
                                    ...editLogForm,
                                    quantity: e.target.value,
                                  })
                                }
                                placeholder="Quantity"
                              />
                              <input
                                type="number"
                                className="border p-1 w-1/2 rounded text-sm"
                                value={editLogForm.amount || ""}
                                onChange={(e) =>
                                  setEditLogForm({
                                    ...editLogForm,
                                    amount: Number(e.target.value),
                                  })
                                }
                                placeholder="Amount in ₹"
                              />
                            </div>
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                onClick={() => setEditingLogId(null)}
                                className="text-slate-500 bg-slate-200 px-3 py-1 rounded text-xs font-bold"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={async () => {
                                  if (state.currentRole === "Office Staff") {
                                    const reason = await prompt("Please provide a reason for editing this entry. (This will be sent to Admin for approval)");
                                    if (reason === null) return;
                                    if (!reason) return addToast('Reason is required', 'error');
                                    addApprovalRequest({
                                      projectId: selectedProjectIdForEntry,
                                      module: "ExpenseEntry",
                                      recordId: item.id,
                                      action: "Edit",
                                      requestedBy: state.currentUser?.name || "Unknown",
                                      requestedById: state.currentUser?.id || "unknown",
                                      requestedByRole: state.currentRole,
                                      itemName: item.itemName,
                                      newData: editLogForm,
                                      reason: "REQUESTED BY OFFICE STAFF: " + reason
                                    });
                                    addToast('Edit request sent to Admin for approval', 'success');
                                    setEditingLogId(null);
                                    return;
                                  }

                                  const p = state.projects.find(
                                    (px) => px.id === selectedProjectIdForEntry,
                                  );
                                  if (!p) return;

                                  const amount =
                                    Number(editLogForm.amount) || 0;
                                  const originalItem = p.expenseItems?.find(
                                    (i) => i.id === item.id,
                                  );
                                  if (
                                    originalItem &&
                                    originalItem.status === "Approved" &&
                                    originalItem.paidBy === "petty_cash" &&
                                    originalItem.submittedById
                                  ) {
                                    const diff = amount - originalItem.amount;
                                    if (diff !== 0) {
                                      const user = state.users.find(
                                        (u) =>
                                          u.id === originalItem.submittedById,
                                      );
                                      if (
                                        user &&
                                        user.role !== "Admin" &&
                                        user.role !== "Super Admin"
                                      ) {
                                        updateUser(user.id, {
                                          pettyCashBalance:
                                            (user.pettyCashBalance || 0) - diff,
                                        });
                                      }
                                    }
                                  }

                                  const updatedItems =
                                    p.expenseItems?.map((i) =>
                                      i.id === item.id
                                        ? { ...i, ...editLogForm }
                                        : i,
                                    ) || [];
                                  updateProject(p.id, {
                                    expenseItems: updatedItems,
                                  });
                                  setEditingLogId(null);
                                }}
                                className="text-white bg-blue-600 px-3 py-1 rounded text-xs font-bold"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          (() => {
                            const isApproved = item.status === "Approved";
                            const canEdit =
                              state.currentRole === "Super Admin" ||
                              state.currentRole === "Admin" ||
                              state.currentRole === "Office Staff" ||
                              !isApproved;
                            return (
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-800 truncate">
                                      {item.itemName}
                                    </p>
                                    <p className="text-xs text-slate-500 capitalize truncate">
                                      {item.category} • {item.quantity}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                      By: {item.submittedBy || 'Unknown'}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0 gap-1">
                                    <div className="text-right">
                                      <p className="font-bold text-sm text-amber-600">
                                        ₹{item.amount}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-1">
                                        {new Date(
                                          item.date,
                                        ).toLocaleDateString()}
                                      </p>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      {item.status && (
                                        <span
                                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                                            item.status === "Approved"
                                              ? "bg-emerald-50 text-emerald-700"
                                              : item.status === "Rejected"
                                                ? "bg-rose-50 text-rose-700"
                                                : "bg-amber-50 text-amber-700"
                                          }`}
                                        >
                                          {item.status}
                                        </span>
                                      )}
                                      {canEdit && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingLogId(item.id);
                                              setEditLogForm(item);
                                            }}
                                            className="text-slate-400 hover:text-blue-600"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={async () => {
                                              if (state.currentRole === "Office Staff") {
                                                const reason = await prompt("Please provide a reason for deleting this entry. (This will be sent to Admin for approval)");
                                                if (reason === null) return;
                                                if (!reason) return addToast('Reason is required', 'error');
                                                addApprovalRequest({
                                                  projectId: selectedProjectIdForEntry,
                                                  module: "ExpenseEntry",
                                                  recordId: item.id,
                                                  action: "Delete",
                                                  requestedBy: state.currentUser?.name || "Unknown",
                                                  requestedById: state.currentUser?.id || "unknown",
                                                  requestedByRole: state.currentRole,
                                                  itemName: item.itemName,
                                                  reason: "REQUESTED BY OFFICE STAFF: " + reason
                                                });
                                                addToast('Delete request sent to Admin for approval', 'success');
                                                return;
                                              }

                                              if (
                                                await confirm(
                                                  "Delete this entry?",
                                                )
                                              ) {
                                                const enteredPin = await prompt("Enter your Password to confirm deleting this entry:");
                                                if (enteredPin === null) return;
                                                
                                                try {
                                                  const res = await window.fetch('/api/auth/login', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ phone: state.currentUser?.phone, pin: enteredPin })
                                                  });
                                                  
                                                  if (!res.ok) {
                                                    addToast("Incorrect Password.", "error");
                                                    return;
                                                  }
                                                } catch (err) {
                                                  addToast("Failed to verify password.", "error");
                                                  return;
                                                }

                                                const reason = await prompt("Please provide a reason for deleting this entry:");
                                                if (!reason) return;
                                                const p = state.projects.find(
                                                  (px) =>
                                                    px.id ===
                                                    selectedProjectIdForEntry,
                                                );
                                                if (!p) return;

                                                if (
                                                  item.status === "Approved" &&
                                                  item.paidBy ===
                                                    "petty_cash" &&
                                                  item.submittedById
                                                ) {
                                                  const user = state.users.find(
                                                    (u) =>
                                                      u.id ===
                                                      item.submittedById,
                                                  );
                                                  if (
                                                    user &&
                                                    user.role !== "Admin" &&
                                                    user.role !== "Super Admin"
                                                  ) {
                                                    updateUser(user.id, {
                                                      pettyCashBalance:
                                                        (user.pettyCashBalance ||
                                                          0) + item.amount,
                                                    });
                                                  }
                                                }

                                                const updatedItems =
                                                  p.expenseItems?.filter(
                                                    (i) => i.id !== item.id,
                                                  ) || [];
                                                  
                                                addToRecycleBin({
                                                  projectId: p.id,
                                                  itemType: 'Field Entry (' + item.category + ')',
                                                  itemName: item.itemName,
                                                  itemData: { expenseItemId: item.id, data: item },
                                                  deletedBy: state.currentUser?.name || 'Unknown',
                                                  deleteReason: reason
                                                });
                                                  
                                                updateProject(p.id, {
                                                  expenseItems: updatedItems,
                                                });
                                              }
                                            }}
                                            className="text-slate-400 hover:text-red-600"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {item.status === "Rejected" &&
                                  item.rejectionReason && (
                                    <div className="mt-3 text-xs text-rose-700 bg-rose-50/80 p-2.5 rounded-lg border border-rose-100 flex gap-2">
                                      <span className="font-bold shrink-0">
                                        Admin Note:
                                      </span>
                                      <span>{item.rejectionReason}</span>
                                    </div>
                                  )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No recent entries found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Camera Modal */}
      <LiveCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(base64) => {
          if (onCameraCapture) {
            onCameraCapture(base64);
          }
        }}
        projectName={(() => {
          // 1. Try selectedProjectIdForEntry
          if (selectedProjectIdForEntry) {
            const p = state.projects.find((p) => p.id === selectedProjectIdForEntry);
            if (p) return p.name;
          }
          // 2. Try global selectedProjectId
          if (state.selectedProjectId) {
            const p = state.projects.find((p) => p.id === state.selectedProjectId);
            if (p) return p.name;
          }
          // 3. Try user's first assigned project
          const assignedIds = state.currentUser?.assignedProjects || (state.currentUser as any)?.assigned_projects || [];
          if (assignedIds.length > 0) {
            const p = state.projects.find((p) => p.id === assignedIds[0]);
            if (p) return p.name;
          }
          // 4. Try first of available projects
          if (availableProjects && availableProjects.length > 0) {
            return availableProjects[0].name;
          }
          // 5. Try first project in state
          if (state.projects && state.projects.length > 0) {
            return state.projects[0].name;
          }
          return "Unknown Project";
        })()}
        userName={state.currentUser?.name || "Unknown Munshi"}
        userRole={state.currentUser?.role || "Munshi"}
        gpsCoords={gpsCoords}
      />
    </div>
  );
}
