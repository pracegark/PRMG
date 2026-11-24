(() => {
  const skillGroups = [
    ["Heavy Earthmoving, Excavation & Civil Site Prep", [
      "Hydraulic Excavator (Mini to Ultra)", "Crawler Dozer (D4-D10)", "Motor Grader & Fine Grading",
      "Smooth Drum/Padfoot Roller", "Pile Driver & Sheet Piling Rig", "Skid Steer/Track Loader (Bobcat)",
      "Articulated Off-Road Dump Truck", "Laser Screed & Site Grading GPS", "Backhoe Loader Operator",
      "Trenching Machine & Ditch Witch", "Wheel Loader & Front-End", "Horizontal Directional Boring (HDD)"
    ]],
    ["Heavy Civil Construction, Concrete & Structural Foundation", [
      "Formwork Carpentry (Wall/Deck)", "Concrete Pumping & Placement", "Post-Tension Cable Installation",
      "Asphalt Paving & Milling Ops", "Rebar Fabrication & Rodbusting", "Foundation & Pier Excavation",
      "Shotcrete & Gunite Application", "Culvert & Drainage Installation", "Anchor Bolt Setting & Survey",
      "Slipform & Tunnel Concrete", "Structural Grouting & Epoxies", "Demolition & Concrete Breaking"
    ]],
    ["Cranes, Lifting, Aerial & Rigging Machinery", [
      "Rough Terrain (RT) Crane", "Crawler Crane Operations", "Overhead Bridge & Gantry Crane",
      "Telehandler / Reach Forklift", "Boom Truck & Crane Truck", "Certified Rigger (Level I/II)",
      "Winch Truck & Gin Pole Ops", "Heavy Lift Spreader Bars", "Scissor Lift & Boom Lift (AWP)",
      "Industrial Warehouse Forklift", "Heavy Material Hoist / Elevator", "Signalperson & Crane Rigger"
    ]],
    ["Welding, Metal Fabrication & Cutting", [
      "Stick Welding (SMAW - All Positions)", "MIG Welding (GMAW - Solid)", "6GR Flux-Core Welder",
      "High-Pressure Pipe Welding (6G)", "TIG Welding (GTAW - Alloy/SS)", "Metal Brake, Shear & Roll",
      "Structural Steel Ironworking", "Stud Welding Machine Ops", "Oxy-Fuel Cutting & Burning Torch",
      "Carbon Arc Gouging & Prep", "Plasma Arc Cutting Systems", "Orbital Tube Welding & Fitup"
    ]],
    ["Industrial Electrical, Power & Instrumentation", [
      "Heavy Industrial Conduit Bending", "Cable Pulling & Termination", "Switchgear & Transformer Install",
      "Medium/High Voltage Splicing", "Motor Control Center (MCC) Maintenance", "Industrial Lighting & Panels",
      "Grounding & Lightning Protection", "Fiber Optic Splicing & Testing", "Instrument Loop Calibration",
      "PLC & SCADA Hardware Setup", "Portable Generator Hookup & Generator Ops", "Hazardous Location (Class I Div 1/2)"
    ]],
    ["Pipefitting, HVAC, Plumbing & Mechanical Systems", [
      "Carbon & Alloy Steel Pipe Welding", "PVC, HDPE & Ductile Iron Fusion", "Stainless Steel Tubing & Fitting",
      "Hydrostatic & Pneumatic Testing", "Flange Management & Torque/Tension", "Valve Overhaul, Packing & Set",
      "Copper Brazing & Soldering", "Industrial Chiller & AHU Maintenance", "Steam Trap & Boiler Piping",
      "Industrial Pump & Compressor Alignment", "Millwright Rotating Equipment", "Commercial Ductwork Fab & Install"
    ]],
    ["Upstream, Midstream, Downstream Oil & Gas, and Marine", [
      "Offshore Platform Maintenance", "Compressor & Pump Station Ops", "Tank Battery & Separator Maintenance",
      "Cross-Country Pipeline Construction", "Refinery & Chemical Plant Turnarounds", "Wellhead Hookup & Frac Support",
      "HUET & BOSIET Marine Survival", "Subsea Umbilicals & Riser Hookup", "Tank & Vessel Cleaning/Flare Ops",
      "Barge Crane & Deck Operations", "Mud System & Glycol Unit Maintenance", "Pipeline Pigging & Hot Tapping"
    ]],
    ["Safety, Scaffolding, Insulation & Specialty Services", [
      "Scaffolding Erection & Dismantle", "Abrasive Blasting & Marine Painting", "H2S Safety & Gas Monitor Ops",
      "Confined Space Attendant/Entry", "Lockout/Tagout (LOTO) Authorized", "Fire Watch & Hot Work Safety",
      "Asbestos & NORM Abatement Tech", "Industrial Insulation & Jacketing", "Hydroblaster & Pressure Washing",
      "Safety Representative / HSE Officer", "Fall Protection & Harness Inspector", "Rope Access Technician (IRATA)"
    ]],
    ["Quality Control, NDT Inspection & Mechanical Testing", [
      "Radiographic Testing (RT) Prep", "Ultrasonic Testing (UT) Support", "Positive Material Identification (PMI)",
      "Certified Weld Inspector (AWS CWI)", "Magnetic Particle Testing (MT)", "Protective Coating Inspector (NACE)",
      "Liquid Penetrant Testing (PT)", "Hardness & Brinell Testing", "QA/QC Documentation & ISO Review",
      "Concrete Slump & Cylinder Testing", "Dimensional Quality Inspection", "Soil Compaction & Density Testing"
    ]]
  ];

  const desiredPositions = [
    "3G-4G Welder", "6GR Fluxcore Welder", "Account Manager", "Asbestos Abatement Supervisor", "Asbestos Abatement Worker",
    "Asphalt Distributor Driver (Tack Coat)", "Asphalt / Concrete Plant Operator", "Asphalt Paving Machine Operator", "Asphalt Screed Operator",
    "Barge - Crawler Crane Operator", "Barge - Deck Crane Operator", "Barge - Domestic/Galley Staff", "Barge - Foreman",
    "Barge - Laborer/Rigger", "Barge - Leaderman", "Barge - Oiler", "Barge - Superintendent", "Barge Supervisor (BS)",
    "Blaster/Painter", "Boilermaker", "Carpenter", "Carpenter Helper", "Casing Crew", "Casing Crew Supervisor",
    "CDL Class A Driver", "CDL Class B Driver", "Clerk", "CNA", "Combination Welder", "Communications Technician",
    "Compliance Technician", "Compliance/Regulatory Auditors/HSE", "Concrete Finisher", "Construction Supervisor",
    "Consultant - Drilling (Company Man)", "Consultant - Construction", "Consultant - Diving",
    "Consultant - Well Plug & Abandonment", "Consultant - Wellwork", "Consultant - Platform/Pipeline Decom",
    "Control Systems Technician - PLC, Programmer", "Corrosion Technician", "Craft Recruiter", "Crane Inspector/Mechanic",
    "Crane Inspector/Mechanic Helper", "Crane Operator", "Crane Rigger", "Designer - Piping", "Designer - Structural",
    "Diesel Mechanic", "Domestic Services - Catering, Janitorial", "Dump Truck Driver", "Electrician - ArcFlash, Med/High Voltage",
    "Electrician - Construction", "Electrician - Helper", "Electrician - Platform or Facility",
    "Electrician - Portable Generators, Light Plants", "Explosive Technician", "Fire Fighting Equipment Technician",
    "Fire Watch", "Forklift Operator", "Form Carpenter", "FRAC - Supervisor", "FRAC - Technician", "Galley Hand / Cook",
    "Gas Sampler Technician", "General Laborer", "Guardrail / Barrier Installer", "H2S Technician", "Hazmat Technician",
    "Heavy Equipment Operator", "Horizontal Directional Drill (HDD) Operator", "HVAC Services Technician",
    "Hydraulics Technician", "Hydroblaster", "Hydrostatic Test Technician", "Industrial Carpenter (Cooling Towers)",
    "Inspector - Blasting (Sand or Water)", "Inspector - Paint", "Instrument Technician - Electrical", "Insulator",
    "Ironworker", "Ironworker Helper", "Lead Abatement Worker / Supervisor", "Mechanic", "Mechanic - Helper",
    "Milling Machine Operator", "Millwright", "NDT - Non-Destructive Testing / X-Ray Technicians", "NORM Worker",
    "Offshore Installation Manager (OIM)", "Overhead Hoist Technician", "Paint Crew", "Painter", "Paramedic or Medic",
    "Pavement Marking / Striping Technician", "Pile Driver Operator", "Pipe Fitter", "Pipe Welder (TIG/Fluxcore)",
    "Pipefitter Helper", "Pipelayer (Storm, Sanitary, Water)", "Plumber", "Potable Water Technician",
    "Produced Water - Technician (Wemco/Monosep)", "Production - Process Engineer/Specialist", "Production Operator - A Level",
    "Production Operator - B Level", "Production Operator - C Level", "Production Operator - D Level",
    "Production Operator - Foreman", "Production Operator - Lead", "Project Manager", "Pump Operator",
    "Pump Technician - Repair/Maint. (Electrical)", "Pump Technician - Repair/Maint. (Mechanical)", "QA/QC Inspector",
    "Rigging Supervisor / Lift Director", "Rigger/Roustabout", "RN", "Rodbuster", "Roller Operator",
    "Rope Access Technician", "Safety Representative", "Sandblaster", "Scaffolding - Crew",
    "Scaffolding - Supervisor (Competent Person)", "Scaffolding Inspector", "Shiftfitter",
    "Soil Stabilization / Reclaimer Operator", "Structural Fitter", "Survival Craft Technician",
    "Tank & Vessel Cleaning/Repair Crew", "Tank & Vessel Cleaning/Repair Supervisor",
    "Traffic Control Supervisor / Flagger", "Truck Driver", "Utility Locator / Potholer", "Vacuum Truck Driver / Operator",
    "Valve Technician", "Valve Technician Helper", "Welder - Supervisor", "Welder Helper"
  ];

  const createMultiSelect = (container, { name, options, idPrefix, placeholder }) => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "multi-select-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-haspopup", "listbox");
    const valueText = document.createElement("span");
    valueText.className = "multi-select-value";
    const count = document.createElement("span");
    count.className = "multi-select-count";
    const chevron = document.createElement("span");
    chevron.className = "multi-select-chevron";
    chevron.setAttribute("aria-hidden", "true");
    trigger.append(valueText, count, chevron);

    const selectedList = document.createElement("div");
    selectedList.className = "multi-select-selected";
    selectedList.setAttribute("aria-label", "Selected options");
    selectedList.hidden = true;

    const menu = document.createElement("div");
    menu.className = "multi-select-menu";
    menu.hidden = true;
    const search = document.createElement("input");
    search.type = "search";
    search.className = "multi-select-search";
    search.placeholder = "Search options…";
    search.setAttribute("aria-label", `Search ${placeholder.toLowerCase()}`);
    search.autocomplete = "off";
    const list = document.createElement("div");
    list.className = "multi-select-options";
    list.id = `${idPrefix}-options`;
    list.setAttribute("role", "group");
    trigger.setAttribute("aria-controls", list.id);
    const empty = document.createElement("p");
    empty.className = "multi-select-empty";
    empty.textContent = "No matching options";
    empty.hidden = true;

    options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "multi-select-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = name;
      input.value = option;
      input.id = `${idPrefix}-${index}`;
      label.htmlFor = input.id;
      label.append(input, document.createTextNode(option));
      list.append(label);
    });
    menu.append(search, list, empty);
    container.classList.add("multi-select");
    container.append(trigger, selectedList, menu);

    const update = () => {
      const selected = Array.from(list.querySelectorAll("input:checked"));
      valueText.textContent = placeholder;
      count.textContent = selected.length ? `${selected.length} selected` : "";
      count.hidden = selected.length === 0;
      selectedList.replaceChildren();
      selected.forEach((input) => {
        const chip = document.createElement("span");
        chip.className = "multi-select-chip";
        const label = input.closest("label");
        chip.append(document.createTextNode(label?.textContent.trim() || input.value));
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.setAttribute("aria-label", `Remove ${input.value}`);
        remove.addEventListener("click", () => {
          input.checked = false;
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
        chip.append(remove);
        selectedList.append(chip);
      });
      selectedList.hidden = selected.length === 0;
      trigger.classList.toggle("has-selection", selected.length > 0);
    };
    const close = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      container.classList.remove("is-open");
    };
    trigger.addEventListener("click", () => {
      const opening = menu.hidden;
      document.querySelectorAll(".multi-select.is-open").forEach((openSelect) => {
        openSelect.querySelector(".multi-select-menu").hidden = true;
        openSelect.querySelector(".multi-select-trigger").setAttribute("aria-expanded", "false");
        openSelect.classList.remove("is-open");
      });
      menu.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
      container.classList.toggle("is-open", opening);
      if (opening) search.focus();
    });
    list.addEventListener("change", update);
    search.addEventListener("input", () => {
      const query = search.value.trim().toLocaleLowerCase();
      let visibleCount = 0;
      list.querySelectorAll(".multi-select-option").forEach((label) => {
        const match = label.textContent.toLocaleLowerCase().includes(query);
        label.hidden = !match;
        if (match) visibleCount += 1;
      });
      empty.hidden = visibleCount > 0;
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        trigger.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!container.contains(event.target)) close();
    });
    update();
  };

  createMultiSelect(document.getElementById("shift-availability"), {
    name: "shiftAvailability", options: ["Day", "Night", "Offshore"], idPrefix: "shift", placeholder: "Choose available shifts"
  });
  createMultiSelect(document.getElementById("drivers-license"), {
    name: "driversLicense", options: ["Class A", "Class B", "Class E", "Chauffeur’s", "None"], idPrefix: "license", placeholder: "Choose license types"
  });

  const workHistory = document.getElementById("work-history-fields");
  const addWorkEntry = document.getElementById("add-work-entry");
  const renumberWorkEntries = () => {
    const entries = Array.from(workHistory.querySelectorAll("[data-work-entry]"));
    entries.forEach((entry, index) => {
      entry.dataset.workEntry = String(index);
      entry.querySelector(".work-entry-title").textContent = `Job ${index + 1}${index === 0 ? " (Most recent)" : ""}`;
      entry.querySelectorAll("[data-work-field]").forEach((field) => {
        field.name = `workHistory.${index}.${field.dataset.workField}`;
      });
    });
    addWorkEntry.hidden = entries.length >= 5;
  };
  const addJob = (index) => {
    const entry = document.createElement("section");
    entry.className = "work-entry";
    entry.dataset.workEntry = String(index);
    const header = document.createElement("div");
    header.className = "work-entry-header";
    const heading = document.createElement("h3");
    heading.className = "work-entry-title";
    heading.textContent = `Job ${index + 1}${index === 0 ? " (Most recent)" : ""}`;
    header.append(heading);
    if (index > 0) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-work-entry";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove Job ${index + 1}`);
      remove.title = "Remove this job experience";
      remove.addEventListener("click", () => {
        entry.querySelectorAll("input, textarea, select").forEach((field) => {
          field.value = "";
          if (field.type === "checkbox" || field.type === "radio") field.checked = false;
        });
        entry.remove();
        renumberWorkEntries();
      });
      header.append(remove);
    }
    entry.append(header);

    const grid = document.createElement("div");
    grid.className = "application-grid two-column";
    [["Company", "company"], ["Title", "title"], ["Dates from", "from"], ["To", "to"]].forEach(([labelText, field]) => {
      const label = document.createElement("label");
      label.textContent = labelText;
      const input = document.createElement("input");
      input.name = `workHistory.${index}.${field}`;
      input.dataset.workField = field;
      input.autocomplete = "off";
      if (field === "from" || field === "to") input.type = "month";
      label.append(input);
      grid.append(label);
    });

    const dutiesLabel = document.createElement("label");
    dutiesLabel.className = "span-two";
    dutiesLabel.textContent = "Key duties, equipment operated & major projects";
    const duties = document.createElement("textarea");
    duties.name = `workHistory.${index}.duties`;
    duties.dataset.workField = "duties";
    duties.rows = 3;
    dutiesLabel.append(duties);
    grid.append(dutiesLabel);
    entry.append(grid);
    workHistory.append(entry);
    renumberWorkEntries();
  };
  addJob(0);
  addWorkEntry.addEventListener("click", () => {
    const nextIndex = workHistory.querySelectorAll("[data-work-entry]").length;
    if (nextIndex < 5) addJob(nextIndex);
  });

  const certificationFields = document.getElementById("certification-fields");
  for (let index = 0; index < 3; index += 1) {
    const entry = document.createElement("div");
    entry.className = "certification-entry application-grid two-column";
    entry.dataset.certificationEntry = String(index);
    const nameLabel = document.createElement("label");
    nameLabel.textContent = `${index + 1}. Certification / license name`;
    const name = document.createElement("input");
    name.name = `certifications.${index}.name`;
    nameLabel.append(name);
    const expirationLabel = document.createElement("label");
    expirationLabel.textContent = "Expiration date";
    const expiration = document.createElement("input");
    expiration.type = "date";
    expiration.name = `certifications.${index}.expiration`;
    expirationLabel.append(expiration);
    entry.append(nameLabel, expirationLabel);
    certificationFields.append(entry);
  }

  const skillContainer = document.getElementById("skill-groups");
  skillGroups.forEach(([groupName, items], groupIndex) => {
    const details = document.createElement("details");
    details.className = "skill-group";
    const summary = document.createElement("summary");
    summary.textContent = `${String.fromCharCode(65 + groupIndex)}. ${groupName}`;
    const picker = document.createElement("div");
    createMultiSelect(picker, {
      name: "skillProficiency", options: items, idPrefix: `skill-${groupIndex}`, placeholder: "Search and select skills"
    });
    details.append(summary, picker);
    skillContainer.append(details);
  });

  const positionContainer = document.getElementById("position-options");
  createMultiSelect(positionContainer, {
    name: "desiredPositions", options: desiredPositions, idPrefix: "position", placeholder: "Search and select positions"
  });
})();
