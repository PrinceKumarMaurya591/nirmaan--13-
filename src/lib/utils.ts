export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export const formatINR = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export const resizeImage = (file: File, maxWidth = 600, maxHeight = 600): Promise<string> => {
  return new Promise((resolve) => {
    // If it's a PDF or non-image, just read and return as is
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(event.target?.result as string); // fallback
        
        ctx.fillStyle = '#FFF'; // handle transparent pngs
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); // 80% quality jpeg
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

function escapeHtml(unsafe: string) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

export const openMediaInNewTab = (mediaUrl: string, mediaName: string, mediaType: string = 'image', customContent?: string) => {
  mediaName = escapeHtml(mediaName);
  let finalUrl = mediaUrl;
  
  // Convert data URLs to Blob URLs to bypass Chrome blocking data URIs in iframes/tabs
  if (mediaUrl.startsWith('data:')) {
    try {
      const arr = mediaUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (mimeMatch && arr.length === 2) {
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], {type: mime});
        finalUrl = URL.createObjectURL(blob);
      }
    } catch (e) {
      console.error("Failed to convert data URI to blob URL", e);
    }
  }

  const isPdf = mediaType.includes('pdf') || mediaUrl.startsWith('data:application/pdf');
  const isImage = mediaType.includes('image') || mediaUrl.startsWith('data:image');

  if (isPdf && !customContent) {
    // Open PDF directly so the browser's native PDF viewer takes over
    const newTab = window.open(finalUrl);
    if (!newTab) {
      alert("Popup blocked! Please allow popups for this site.");
    }
    return;
  }

  const newTab = window.open();
  if (newTab) {
    
    let contentHtml = '';
    
    if (customContent) {
      contentHtml = customContent;
    } else if (isPdf) {
      contentHtml = `<iframe src="${finalUrl}" frameborder="0" style="flex: 1; border:0; width:100%; height: 100vh;" allowfullscreen></iframe>`;
    } else if (isImage) {
      contentHtml = `<img src="${finalUrl}" style="max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); border: 1px solid #e2e8f0; margin-top: 20px;" />`;
    } else {
      contentHtml = `
        <div style="padding: 40px; text-align: center;">
          <h2 style="color: #334155;">Preview not available</h2>
          <p style="color: #64748b; margin-bottom: 20px;">This file format cannot be previewed directly in the browser.</p>
        </div>
      `;
    }

    newTab.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${mediaName}</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            font-family: system-ui, -apple-system, sans-serif;
            align-items: center;
          }
          .toolbar {
            width: 100%;
            background: #ffffff;
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 24px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 12px;
            box-sizing: border-box;
            box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          }
          .btn-download {
            background: #3b82f6;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: background 0.2s;
          }
          .btn-download:hover {
            background: #2563eb;
          }
          .btn-print {
            background: #ffffff;
            color: #0f172a;
            border: 1px solid #cbd5e1;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .btn-print:hover {
            background: #f1f5f9;
          }
          @media print {
            .toolbar {
              display: none !important;
            }
            body {
              background: white;
            }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <a href="${finalUrl}" download="${mediaName}" class="btn-download">Download</a>
          <button onclick="window.print()" class="btn-print">Print</button>
        </div>
        ${contentHtml}
      </body>
      </html>
    `);
    newTab.document.close();
  }
};

export const fetchLocationName = async (lat: number, lng: number): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout limit
    const url = `/api/geocode?lat=${lat}&lng=${lng}`;
    
    const headers = new Headers();
    try {
      const auth = localStorage.getItem("thikedar_auth");
      if (auth) {
        const { phone, pin, token } = JSON.parse(auth);
        if (token) headers.set("Authorization", `Bearer ${token}`);
        else if (phone && pin) {
          headers.set("x-user-phone", phone);
          headers.set("x-user-pin", pin);
        }
      }
    } catch(e) {}

    const response = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (err) {
    console.warn("Backend geocoding failed:", err);
  }

  return `Coordinates: ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
};

export const stampImageWithMetadata = async (
  base64Src: string,
  projectName: string,
  userName: string,
  coords: { lat: number; lng: number, alt?: number | null } | null,
  role: string
): Promise<string> => {
  let locationName = "";
  if (coords) {
    locationName = await fetchLocationName(coords.lat, coords.lng);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64Src); // fallback

      // Draw original image
      ctx.drawImage(img, 0, 0);

      const imgWidth = img.width;
      const imgHeight = img.height;
      
      const now = new Date();
            const dateString = now.toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

      const gpsString = coords 
         ? `LAT: ${coords.lat.toFixed(6)}° N | LON: ${coords.lng.toFixed(6)}° E` + (coords.alt ? ` | ALT: ${coords.alt.toFixed(1)}m` : '')
         : `GPS: Location Services Disabled`;

      const fontSize = Math.max(14, Math.round(imgWidth * 0.026));
      const projectFont = `bold ${fontSize + 2}px "Inter", "Segoe UI", sans-serif`;
      const projectColor = '#fcd34d'; // amber-300
      const defaultFont = `500 ${fontSize}px "Inter", "Segoe UI", sans-serif`;
      const defaultColor = '#FFFFFF';
      const paddingLeft = Math.max(20, Math.round(imgWidth * 0.04));

      
      const getLines = (ctx, text, maxWidth) => {
        var words = text.split(" ");
        var lines = [];
        var currentLine = words[0];

        for (var i = 1; i < words.length; i++) {
          var word = words[i];
          var width = ctx.measureText(currentLine + " " + word).width;
          if (width < maxWidth) {
            currentLine += " " + word;
          } else {
            lines.push(currentLine);
            currentLine = word;
          }
        }
        lines.push(currentLine);
        return lines;
      };

      const lines: { text: string; color: string; font: string }[] = [];
      const cleanProject = projectName.toUpperCase();
      
      const maxTextWidth = imgWidth - (paddingLeft * 2.5) - 60; // leaving space for watermark
      
      ctx.font = projectFont;
      const projPrefix = "PROJECT  : ";
      const projLines = getLines(ctx, cleanProject, maxTextWidth - ctx.measureText(projPrefix).width);
      projLines.forEach((l, i) => {
         lines.push({ text: i === 0 ? projPrefix + l : "           " + l, color: projectColor, font: projectFont });
      });
      
      lines.push({ text: `DATE/TIME: ${dateString.toUpperCase()}`, color: defaultColor, font: defaultFont });
      lines.push({ text: `GPS COORD: ${gpsString}`, color: defaultColor, font: defaultFont });

      if (coords && locationName && !locationName.includes("UNAVAILABLE")) {
        ctx.font = defaultFont;
        const locPrefix = "LOCATION : ";
        const locLines = getLines(ctx, locationName.toUpperCase(), maxTextWidth - ctx.measureText(locPrefix).width);
        locLines.forEach((l, i) => {
           lines.push({ text: i === 0 ? locPrefix + l : "           " + l, color: defaultColor, font: defaultFont });
        });
      }

      // Better UI watermark styling
      const lineCount = lines.length;
      
      
      const lineHeight = fontSize * 1.5;
      
      const bannerHeight = (lineCount * lineHeight) + (paddingLeft * 2);

      // Draw dark semi-transparent banner background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, imgHeight - bannerHeight, imgWidth, bannerHeight);

      // Draw Amber accent line at the top of the banner
      ctx.fillStyle = '#f59e0b'; // Tailwind amber-500
      ctx.fillRect(0, imgHeight - bannerHeight, imgWidth, 4);

      // Setup Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const startY = imgHeight - bannerHeight + paddingLeft;

      lines.forEach((lineObj, index) => {
        ctx.font = lineObj.font;
        ctx.fillStyle = lineObj.color;
        ctx.fillText(lineObj.text, paddingLeft, startY + (index * lineHeight));
      });
      
      // Draw DSR / Nirmaan Watermark in the bottom right corner
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.font = `bold ${fontSize + 4}px "Inter", "Segoe UI", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillText("NIRMAAN BY DSR", imgWidth - paddingLeft, imgHeight - paddingLeft);

      resolve(canvas.toDataURL('image/jpeg', 0.85)); // slightly better quality
    };
    img.onerror = () => resolve(base64Src);
    img.src = base64Src;
  });
};

export function normalizeVendorName(vName: string): string {
  if (!vName) return '';
  let name = vName.trim().toUpperCase();
  
  // Normalize MACHINERY to MACHINE
  name = name.replace(/MACHINERY:/g, 'MACHINE:');
  
  // Define known prefixes to clean up duplicates
  const prefixes = ['MACHINE', 'LABOR', 'SHIFTING', 'SUBCONTRACTOR'];
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of prefixes) {
      const doublePrefix = `${prefix}: ${prefix}:`;
      if (name.startsWith(doublePrefix)) {
        name = name.replace(doublePrefix, `${prefix}:`);
        changed = true;
      }
    }
  }
  
  return name.replace(/\s+/g, ' ').trim();
}


export function getCalculatedProjectBalance(userId: string, projectId: string, projects: any[]): number {
  const project = projects.find(p => p.id === projectId);
  if (!project) return 0;
  
  let balance = 0;
  
  // Advances
  (project.advanceHistory || []).forEach((adv: any) => {
    if (adv.userId === userId) {
      balance += adv.amount;
    }
  });
  
  // Expenses (Material, Labor, Machinery, Shifting, Misc)
  (project.expenseItems || []).forEach((exp: any) => {
    if (exp.submittedById === userId && exp.paidBy === 'petty_cash' && exp.status !== 'Rejected') {
      balance -= exp.amount;
    }
  });
  
  // Supplier Payments
  (project.supplierPayments || []).forEach((pay: any) => {
    if (pay.submittedById === userId && pay.paidBy === 'petty_cash' && pay.status !== 'Rejected') {
      balance -= pay.amount;
    }
  });

  // Labor Attendance Advances
  (project.labors || []).forEach((labor: any) => {
    // If the labor entry was created by this user, the attendance advance is attributed to them?
    // Wait, Labor entry createdBy is not enough. Multiple munshis can mark attendance.
    // LaborAttendance does not have submittedById!
    // But currently MunshiEntry deducts from the active user's pettyCashBalance when marking attendance with advance.
  });

  return balance;
}


export function getUserProjectBalance(userId: string, projectId: string, projects: any[]): number {
  const project = projects.find(p => p.id === projectId);
  if (!project) return 0;
  
  let balance = 0;
  
  // Advances given to the user in this project
  (project.advanceHistory || []).forEach((adv: any) => {
    if (adv.userId === userId) {
      balance += adv.amount;
    }
  });
  
  // Expenses logged by user (paid by petty cash)
  // This includes Material, Labor Advance, Machinery, Shifting, Misc
  (project.expenseItems || []).forEach((exp: any) => {
    if (exp.submittedById === userId && exp.paidBy === 'petty_cash' && exp.status !== 'Rejected') {
      balance -= exp.amount;
    }
  });
  
  // Supplier payments
  (project.supplierPayments || []).forEach((pay: any) => {
    if (pay.submittedById === userId && pay.paidBy === 'petty_cash' && pay.status !== 'Rejected') {
      balance -= pay.amount;
    }
  });

  return balance;
}

export function getUserTotalBalance(userId: string, projects: any[]): number {
  let total = 0;
  for (const p of projects) {
    total += getUserProjectBalance(userId, p.id, projects);
  }
  return total;
}
