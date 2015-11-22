/* jshint -W003 */
/* jshint -W040 */
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/mocha/mocha.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />

"use strict";

//TODO process substanceAdministration/performer
// Startup file for debugging
//var fs = require('fs');
var _ = require("lodash");

var getResource = function (resType, init) {
    var res = {
        'resourceType': resType
    };
    if (init) {
        _.merge(res, init);
    }
    return res;
};

var serial = 0;

var attachTemplate = function (node, templateId) {
    node.templateId = templateId;
    return node;
};

/**
 * Construct triplet used as reference to a node and associated data.
 * @param {Object} node
 * @param {Object} entity
 * @param {Array} [templateId]
 */
var Triplet = function (node, entity, templateId) {
    this.node = node;
    this.entity = entity;
    if (templateId) {
        this.templateId = templateId;
    }
};

var findPatient = function (bundle) {
    var patient;
    _.each(bundle.entry, function (value) {
        if (value.resource.resourceType === 'Patient') {
            patient = value.resource;
            return false;
        }
        return true;
    });
    return patient;
};

var dateFix = function (date) {
    if (date) {
        switch (date.length) {
        case 6:
            return date.substr(0, 4) + '-' + date.substr(4, 2);
        case 8:
            return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2);
        case 12: //200003231430
            return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2) + 'T' + date.substr(8, 2) + ':' + date.substr(10, 2) + ':00';
        case 19: //20090227130000+0500
            return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2) + 'T' + date.substr(8, 2) + ':' + date.substr(10, 2) + ':' + date.substr(12, 2); // + 'GMT' + date.substr(14, 3);
        }
    }
    return date;
};

var valueFix = function (node) {
    var value = {};
    if (node.attributes['xsi:type'] === 'PQ') {
        var tmp = Number(node.attributes.value);
        if (tmp === Number.NaN) {
            tmp = node.attributes.value;
        }
        value = {
            'value': tmp,
            'unit': node.attributes.unit
        };
    }
    return value;
};

var isInContextOf = function (oids) {
    var inContext;
    if (_.isArray(oids)) {
        inContext = _.findLast(proto.control, function (triplet) {
            return _.any(triplet.templateId, function (value) {
                return _.contains(oids, value);
            });
        });
    } else {
        inContext = _.findLast(proto.control, function (triplet) {
            return _.contains(triplet.templateId, oids);
        });
    }
    return inContext || false;
};

var store2bundle = function (resource, patientId) {
    proto.bundle.entry.push({
        'resource': resource
    });
    if (proto.composition) {
        proto.composition.section.push({
            'entry': [{
                'reference': resource.id
            }]
        });
    }
};

var makeCode = function (node, dropDisplayeElement) {
    var isOidBased = (/[\d\.]+/.test(node.attributes.codeSystem));
    var system;
    if (isOidBased) {
        //Reference - http://www.hl7.org/FHIR/2015May/terminologies-systems.html
        //TODO - complete recoding
        switch (node.attributes.codeSystem) {
        case '2.16.840.1.113883.6.96':
            system = 'http://snomed.info/sct';
            break;
        case '2.16.840.1.113883.6.88':
            system = 'http://www.nlm.nih.gov/research/umls/rxnorm';
            break;
        case '2.16.840.1.113883.6.1':
            system = 'http://loinc.org';
            break;
        case '2.16.840.1.113883.6.8':
            system = 'http://unitsofmeasure.org';
            break;
        case '2.16.840.1.113883.3.26.1.2':
            system = 'http://ncimeta.nci.nih.gov';
            break;
        case '2.16.840.1.113883.6.12':
            system = 'http://www.ama-assn.org/go/cpt';
            break;
        case '2.16.840.1.113883.6.209':
            system = 'http://hl7.org/fhir/ndfrt';
            break;
        case '2.16.840.1.113883.4.9':
            system = 'http://hl7.org/fhir/ndfrt';
            break;
        case '2.16.840.1.113883.4.9':
            system = 'http://fdasis.nlm.nih.gov';
            break;
        case '2.16.840.1.113883.12.292':
            system = 'http://www2a.cdc.gov/vaccines/iis/iisstandards/vaccines.asp?rpt=cvx';
            break;
        case '1.0.3166.1.2.2':
            system = 'urn:iso:std:iso:3166';
            break;
        case '2.16.840.1.113883.6.301.5':
            system = 'http://www.nubc.org/patient-discharge';
            break;
        case '2.16.840.1.113883.6.256':
            system = 'http://www.radlex.org';
            break;
        case '2.16.840.1.113883.6.3':
            system = 'http://hl7.org/fhir/sid/icd-10';
            break;
        case '2.16.840.1.113883.6.4':
            system = 'http://www.icd10data.com/icd10pcs';
            break;
        case '2.16.840.1.113883.6.42':
            system = 'http://hl7.org/fhir/sid/icd-9';
            break;
        case '2.16.840.1.113883.6.73':
            system = 'http://www.whocc.no/atc';
            break;
        case '2.16.840.1.113883.6.24':
            system = 'urn:std:iso:11073:10101';
            break;
        case '1.2.840.10008.2.16.4':
            system = 'http://nema.org/dicom/dicm';
            break;
        case '2.16.840.1.113883.6.281':
            system = 'http://www.genenames.org';
            break;
        case '2.16.840.1.113883.6.280':
            system = 'http://www.ncbi.nlm.nih.gov/nuccore';
            break;
        case '2.16.840.1.113883.6.282':
            system = 'http://www.hgvs.org/mutnomen';
            break;
        case '2.16.840.1.113883.6.284':
            system = 'http://www.ncbi.nlm.nih.gov/projects/SNP';
            break;
        case '2.16.840.1.113883.3.912':
            system = 'http://cancer.sanger.ac.uk/cancergenome/projects/cosmic';
            break;
        case '2.16.840.1.113883.6.283':
            system = 'http://www.hgvs.org/mutnomen';
            break;
        case '2.16.840.1.113883.6.174':
            system = 'http://www.omim.org';
            break;
        case '2.16.840.1.113883.13.191':
            system = 'http://www.ncbi.nlm.nih.gov/pubmed';
            break;
        case '2.16.840.1.113883.3.913':
            system = 'http://www.pharmgkb.org';
            break;
        case '2.16.840.1.113883.3.1077':
            system = 'http://clinicaltrials.gov';
            break;

        default:
            var v2 = '2.16.840.1.113883.12.';
            if (_.startsWith(v2, node.attributes.codeSystem)) {
                var tail = node.attributes.codeSystem.substring(v2.length);
                system = 'http://hl7.org/fhir/v2/' + tail;
                break;
            }
            system = 'urn:oid:' + node.attributes.codeSystem;
            break;
        }
    }
    var retval = {
        'system': system,
        'code': node.attributes.code
    };
    if (node.attributes.displayName && !dropDisplayeElement) {
        retval.display = node.attributes.displayName;
    }
    return retval;
};

var makeQuantity = function (node) {
    var retval = makeCode(node, true);
    if (retval.unit === 'a') {
        retval.unit = 'years';
    }
    return retval;
};

var recodeAddrUse = function (use) {
    switch (use) {
    case 'H':
    case 'HP':
        return 'home';
    case 'WP':
        return 'work';
    case 'TMP':
        return 'temp';
    case 'OLD':
        return 'old';
    default:
        return use;
    }
};

var recodeTelecomUse = function (use) {
    switch (use) {
    case 'H':
    case 'HP':
        return 'home';
    case 'WP':
        return 'work';
    case 'TMP':
        return 'temp';
    case 'OLD':
        return 'old';
    case 'MC':
        return 'mobile';
    default:
        return use;
    }
};

var recodeGender = function (gender) {
    switch (gender) {
    case 'F': // Female
    case 'f':
        return 'female';
    case 'M': // Male
    case 'm':
        return 'male';
    case 'U': // Undifferentiated
    case 'u':
        return 'unknown';
    default:
        return 'unknown';
    }
};

var recodeNameUse = function (use) {
    // usual | official | temp | nickname | anonymous | old | maiden
    // see http://www.cdapro.com/know/25041
    switch (use) {
    case 'C':
        return 'official';
    case 'L':
        return 'usual';
    case 'A':
    case 'I':
    case 'P':
    case 'R':
        return 'nickname';
    default:
        return use;
    }
};

var recodeTelecom = function (node) {
    if (node.attributes.nullFlavor) {
        return null;
    }
    var telecom = {};

    if (node.attributes.use) {
        telecom.use = recodeTelecomUse(node.attributes.use);
    }

    var attr = node.attributes.value.split(':');
    if (attr.length === 2) {
        switch (attr[0]) {
        case 'tel':
            telecom.system = 'phone';
            telecom.value = attr[1];
            break;
        case 'mailto':
            telecom.system = 'email';
            telecom.value = attr[1];
            break;
        case 'fax':
            telecom.system = 'fax';
            telecom.value = attr[1];
            break;
        case 'http':
        case 'https':
            telecom.system = 'url';
            telecom.value = node.attributes.value;
            break;
        }
    } else {
        telecom.value = node.attributes.value;

    }
    return telecom;
};

var recodeSeverity = function (node) {
    var severity = node.attributes.displayName;
    var criticality = 'CRITU';
    switch (node.attributes.code) {
    case '399166001':
        severity = 'severe';
        criticality = 'CRITH';
        break;
    case '255604002':
        severity = 'mild';
        criticality = 'CRITL';
        break;
    case '371923003':
        severity = 'moderate';
        criticality = 'CRITL';
        break;
    case '6736007':
        severity = 'moderate';
        criticality = 'CRITL';
        break;
    case '371924009':
        severity = 'severe';
        criticality = 'CRITH';
        break;
    case '24484000':
        severity = 'severe';
        criticality = 'CRITH';
        break;
    }
    return {
        'severity': severity,
        'criticality': criticality
    };
};

var recodeAllergyReactionCode = function (node) {

    switch (node.attributes.code) {
    case '420134006':
        return {
            'category': 'other'
        };
    case '418038007':
        return {
            'category': 'environment'
        };
    case '419511003':
        return {
            'category': 'medication'
        };
    case '418471000':
        return {
            'category': 'food'
        };
    case '419199007':
        return {
            'type': 'allergy',
            'category': 'environment'
        };
    case '416098002':
        return {
            'type': 'allergy',
            'category': 'medication'
        };
    case '414285001':
        return {
            'type': 'allergy',
            'category': 'food'
        };
    case '59037007':
        return {
            'type': 'intolerance',
            'category': 'medication'
        };
    case '235719002':
        return {
            'type': 'intolerance',
            'category': 'food'
        };
    }
    return {};
};

var setSocialHistoryCategory = function (observation) {
    if (observation) {
        if (observation.category && observation.category.coding) {
            observation.category.coding.push({
                "code": "social-history",
                "display": "Social history"
            });
        } else {
            observation.category = {
                "coding": [{
                    "code": "social-history",
                    "display": "Social history"
                }]
            };
        }
    }
    return observation;
};

/** Check/create property of an object */
var ensureProperty = function (prop, isArray) {
    if (!this[prop]) {
        this[prop] = (isArray) ? [] : {};
    }
    return this[prop];
};

var findResource = function (id) {
    var resource;

    _.each(this, function (value) {
        if (value.resource.id === id) {
            resource = value.resource;
            return false;
        }
        return true;
    });
    return resource;
};

var findLastResourceOfType = function (resourceType) {
    return _.findLast(this, function (value) {
        return value.resource.resourceType === resourceType;
    });
};

var makeTransactionalBundle = function (bundle, base) {
    _.each(bundle.entry, function (value) {
        value.request = {
            'method': 'POST',
            'url': value.resource.resourceType
        };
        value.base = base;
    });
    return bundle;
};

var makeAndStore = function (resource, patient, subject) {
    var tmp = getResource(resource, {
        'id': resource + '/' + (serial++).toString()
    });
    var id;
    if (patient) {
        tmp.patient = {
            'reference': patient.id
        };
        id = patient.id;
    } else if (subject) {
        tmp.subject = {
            'reference': subject.id
        };
        id = subject.id;
    }
    store2bundle(tmp, id);

    return tmp;
};

var makeAndStoreObservation = function (patient) {

    var observation = getResource('Observation', {
        'id': 'Observation/' + (serial++).toString(),
        'subject': {
            'reference': patient.id
        }
    });
    store2bundle(observation, patient.id);

    return observation;
};

//Make it common root
var proto = {
    tags: [], // Stack of XML tags processed
    bundle: {},
    composition: {},

    obj: function () {
        return this;
    },

    id: function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(this, 'identifier', true).push({
            'system': 'urn:oid:' + node.attributes.root,
            'value': node.attributes.extension
        });
    }
};

//last.prototype = proto;

//CatchAll element
var Dummy = function () {

};

Dummy.prototype = proto;

var dummy = new Dummy();

var Organization = function (organization) {

    this.name$ = function (text) {
        organization.name = text;
    };

    this.telecom = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(organization, 'telecom', true).push(recodeTelecom(node));
    };

    this.addr = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        var address = {};
        if (node.attributes.use) {
            address.use = recodeAddrUse(node.attributes.use);
        }
        ensureProperty.call(organization, 'address', true).push(address);

        proto.control.push(new Triplet(node, new Addr(address)));
    };

};
Organization.prototype = proto;

/**
 * AKA assignedAuthor
 */
var AssignedEntity = function (resource, templateId) {
    var patient = findPatient(proto.bundle);

    if (templateId && _.contains(templateId, '2.16.840.1.113883.10.20.22.4.87')) {
        //Insurance Company Information
        var coverage = resource;
        this._self = {
            id: function (node) {
                if (node.attributes.root) {
                    ensureProperty.call(coverage, 'identifier', true).push({
                        'value': node.attributes.root
                    });
                }
            },
            representedOrganization: function (node) {

                var organization = getResource('Organization', {
                    'id': 'Organization/' + (serial++).toString()
                });
                store2bundle(organization, patient.id);

                coverage.issuer = {
                    'reference': organization.id
                };
                proto.control.push(new Triplet(node, new Organization(organization)));
            }
        };
        this._self.prototype = proto;
    } else if (templateId && _.contains(templateId, '2.16.840.1.113883.10.20.22.4.88')) {
        //Guarantor Information... The person responsible for the final bill.
        var contact = resource;
        this._self = {
            code: function (node) {
                contact.relationship = [{
                    'coding': [makeCode(node)]
                }];
            },
            addr: function (node) {
                if (node.attributes.nullFlavor) {
                    return;
                }
                var address = {};
                if (node.attributes.use) {
                    address.use = recodeAddrUse(node.attributes.use);
                }
                ensureProperty.call(contact, 'address', true).push(address);

                proto.control.push(new Triplet(node, new Addr(address)));
            },

            telecom: function (node) {
                if (node.attributes.nullFlavor) {
                    return;
                }
                ensureProperty.call(contact, 'telecom', true).push(recodeTelecom(node));
            },

            assignedPerson: function (node) {
                proto.control.push(new Triplet(node, new AssignedPerson(contact, 'name')));
            }
        };
    } else {
        var practitioner = resource;

        this._self = {
            id: function (node) {
                if (node.attributes.root) {
                    ensureProperty.call(practitioner, 'identifier', true).push({
                        'value': node.attributes.root
                    });
                }
            },
            code: function (node) {
                ensureProperty.call(practitioner, 'practitionerRole', true).push({
                    'specialty': [{
                        'coding': [makeCode(node)]
                    }]
                });
            },
            addr: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }
                var address = {};
                if (node.attributes.use) {
                    address.use = recodeAddrUse(node.attributes.use);
                }
                ensureProperty.call(practitioner, 'address', true).push(address);

                proto.control.push(new Triplet(node, new Addr(address)));
            },

            telecom: function (node) {
                if (node.attributes.nullFlavor) {
                    return;
                }
                ensureProperty.call(practitioner, 'telecom', true).push(recodeTelecom(node));
            },

            representedOrganization: function (node) {

                var organization = getResource('Organization', {
                    'id': 'Organization/' + (serial++).toString()
                });
                store2bundle(organization, patient.id);

                ensureProperty.call(practitioner, 'practitionerRole', true).push({
                    'managingOrganization': {
                        'reference': organization.id
                    }
                });
                proto.control.push(new Triplet(node, new Organization(organization)));
            },

            assignedPerson: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }

                proto.control.push(new Triplet(node, new AssignedPerson(practitioner)));
            }
        };
    }

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
AssignedEntity.prototype = proto;

var Performer = function (resource) {
    var templateId = [];
    var patient = findPatient(proto.bundle);

    switch (resource.resourceType) {
    case 'Practitioner':
        var practitioner = resource;
        this._self = {
            assignedEntity: function (node) {
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner), templateId));
            }
        };
        this._self.prototype = proto;
        break;
    case 'MedicationAdministration':
        var medicationAdministration = resource;
        this._self = {
            templateId: function (node) {
                templateId.push(node.attributes.root);
            },
            assignedEntity: function (node) {

                var practitioner = makeAndStore('Practitioner', null, null);

                medicationAdministration.practitioner = {
                    'reference': practitioner.id
                };
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner), templateId));
            }
        };
        this._self.prototype = proto;
        break;
    case 'Immunization':
        var immunization = resource;
        this._self = {
            templateId: function (node) {
                templateId.push(node.attributes.root);
            },
            assignedEntity: function (node) {
                var practitioner = getResource('Practitioner', {
                    'id': 'Practitioner/' + (serial++).toString()
                });
                store2bundle(practitioner, patient.id);

                immunization.performer = {
                    'reference': practitioner.id
                };
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner), templateId));
            }
        };
        this._self.prototype = proto;
        break;
    case 'Claim':
        var claim = resource;

        this._self = {
            templateId: function (node) {
                templateId.push(node.attributes.root);
            },
            assignedEntity: function (node) {
                if (templateId.length > 0) {

                    switch (templateId[0]) {
                    case '2.16.840.1.113883.10.20.22.4.87':
                        var coverage = getResource('Coverage', {
                            'id': 'Coverage/' + (serial++).toString(),
                            'subscriber': {
                                'reference': patient.id
                            }
                        });

                        store2bundle(coverage, patient.id);

                        var coverages = ensureProperty.call(claim, 'coverage', true);
                        coverages.push({
                            'sequence': (coverages.length + 1),
                            'coverage': {
                                'reference': coverage.id
                            }
                        });
                        proto.control.push(new Triplet(node, new AssignedEntity(coverage, templateId), templateId));
                        break;
                    case '2.16.840.1.113883.10.20.22.4.88':
                        var contact = {};
                        ensureProperty.call(patient, 'contact', true).push(contact);
                        proto.control.push(new Triplet(node, new AssignedEntity(contact, templateId), templateId));
                        break;
                    }
                }
            }
        };
        this._self.prototype = proto;
        break;
    case 'Procedure':
        var procedure = resource;
        this._self = {
            assignedEntity: function (node) {

                var practitioner = getResource('Practitioner', {
                    'id': 'Practitioner/' + (serial++).toString()
                });
                store2bundle(practitioner, patient.id);

                ensureProperty.call(procedure, 'performer', true).push({
                    'actor': {
                        'reference': practitioner.id
                    }
                });
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner), templateId));
            }
        };
        this._self.prototype = proto;
        break;
    case 'Encounter':
        var encounter = resource;
        this._self = {
            assignedEntity: function (node) {

                var practitioner = getResource('Practitioner', {
                    'id': 'Practitioner/' + (serial++).toString()
                });
                store2bundle(practitioner, patient.id);

                ensureProperty.call(encounter, 'participant', true).push({
                    'type': {
                        'coding': [{
                            'system': 'http://hl7.org/fhir/v3/ParticipationType',
                            'code': 'ATND',
                            'display': 'attender'
                        }]
                    },
                    'individual': {
                        'reference': practitioner.id
                    }
                });
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner), templateId));
            }
        };
        this._self.prototype = proto;
        break;
    }

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
Performer.prototype = proto;

var ManufacturedMaterial = function (resource) {
    var templateId = [];

    switch (resource.resourceType) {
    case 'Medication':
        this._self = {
            templateId: function (node) {
                templateId.push(node.attributes.root);
            },
            code: function (node) {
                resource.code = {
                    'coding': [makeCode(node)],
                    'text': node.attributes.displayName
                };
            }
        };
        this._self.prototype = proto;
        break;
    case 'Immunization':
        this._self = {
            templateId: function (node) {
                templateId.push(node.attributes.root);
            },
            code: function (node) {
                resource.vaccineCode = {
                    'coding': [makeCode(node)]
                };
            },
            lotNumberText$: function (text) {
                resource.lotNumber = text;
            }
        };
        this._self.prototype = proto;
        break;
    }

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
ManufacturedMaterial.prototype = proto;

var ManufacturedProduct = function (resource) {
    var patient = findPatient(proto.bundle);

    switch (resource.resourceType) {
    case 'Medication':
        this._self = {
            manufacturedMaterial: function (node) {
                proto.control.push(new Triplet(node, new ManufacturedMaterial(resource)));
            },

            manufacturerOrganization: function (node) {

                var organization = getResource('Organization', {
                    'id': 'Organization/' + (serial++).toString()
                });
                store2bundle(organization, patient.id);

                resource.manufacturer = {
                    'reference': organization.id
                };
                proto.control.push(new Triplet(node, new Organization(organization)));
            }
        };
        this._self.prototype = proto;
        break;

    case 'Immunization':
        this._self = {
            manufacturedMaterial: function (node) {
                proto.control.push(new Triplet(node, new ManufacturedMaterial(resource)));
            },
            manufacturerOrganization: function (node) {

                var organization = getResource('Organization', {
                    'id': 'Organization/' + (serial++).toString()
                });
                store2bundle(organization, patient.id);

                resource.manufacturer = {
                    'reference': organization.id
                };
                proto.control.push(new Triplet(node, new Organization(organization)));
            }
        };
        break;
    }

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
ManufacturedProduct.prototype = proto;

/**
 * @param {Array} optionalCb array of callback functions will called with id on medication created
 */
var Consumable = function (resource, optionalCb) {
    var patient = findPatient(proto.bundle);

    this.manufacturedProduct = function (node) {

        switch (resource.resourceType) {
        case 'MedicationAdministration':
            var medicationAdministration = resource;

            var medication = getResource('Medication', {
                'id': 'Medication/' + (serial++).toString()
            });
            store2bundle(medication, patient.id);

            medicationAdministration.medicationReference = {
                'reference': medication.id
            };

            if (optionalCb && _.isArray(optionalCb)) {
                for (var cb in optionalCb) {
                    if (_.isFunction(optionalCb[cb])) {
                        optionalCb[cb](medication.id);
                    }
                }
            }

            proto.control.push(new Triplet(node, new ManufacturedProduct(medication)));
            break;
        case 'Immunization':
            var immunization = resource;
            proto.control.push(new Triplet(node, new ManufacturedProduct(immunization)));
            break;
        }
    };
};
Consumable.prototype = proto;

var EffectiveTimeSingleValue = function (object, propertyName) {
    this.low = function (node) {
        object[propertyName] = dateFix(node.attributes.value);
    };
    this.center = function (node) {
        object[propertyName] = dateFix(node.attributes.value);
    };
};
EffectiveTimeSingleValue.prototype = proto;

var EffectiveTime = function (subType, object) {

    this.low = function (node) {
        object.start = dateFix(node.attributes.value);
    };

    this.high = function (node) {
        if (node.attributes.value) {
            object.end = dateFix(node.attributes.value);
        }
    };

    this.period = function (node) {
        object.timing.repeat.period = node.attributes.value;
        object.timing.repeat.periodUnits = node.attributes.unit;
    };

};
EffectiveTime.prototype = proto;

var PlayingEntity = function (allergyIntolerance) {
    this.code = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(allergyIntolerance, 'substance');
        if (!allergyIntolerance.substance.coding) {
            allergyIntolerance.substance.coding = [];
        }
        allergyIntolerance.substance.coding.push(makeCode(node));
    };
    this.translation = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(allergyIntolerance, 'substance');
        if (!allergyIntolerance.substance.coding) {
            allergyIntolerance.substance.coding = [];
        }
        allergyIntolerance.substance.coding.push(makeCode(node));
    };
    this.name$ = function (text) {
        if (allergyIntolerance.resourceType === 'AllergyIntolerance' || allergyIntolerance.resourceType === 'Location') {
            allergyIntolerance.name = text;
        }
    };
};
PlayingEntity.prototype = proto;

var PlayingDevice = function (device) {
    this.code = function (node) {
        ensureProperty.call(device, 'type');
        device.type = {
            'coding': [makeCode(node)]
        };
    };
};
PlayingDevice.prototype = proto;

var genericLocationHandler = function (location) {
    return {
        code: function (node) {
            location.type = {
                'coding': [makeCode(node)]
            };
        },
        addr: function (node) {
            location.address = {};
            proto.control.push(new Triplet(node, new Addr(location.address)));
        },
        playingEntity: function (node) {
            proto.control.push(new Triplet(node, new PlayingEntity(location)));
        }
    };
};

var ParticipantRole = function (resource, contextId) {
    var templateId = [];
    var claim;

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.32': //Service delivery location for procedure
            //search the latest procedure
            var procedure;
            var encounter;
            var patient;
            var location;
            if (isInContextOf('2.16.840.1.113883.10.20.22.4.49')) {
                encounter = resource;
                if (encounter) {
                    patient = findPatient(proto.bundle);

                    location = getResource('Location', {
                        'id': 'Location/' + (serial++).toString()
                    });
                    store2bundle(location, patient.id);

                    ensureProperty.call(encounter, 'location', true).push({
                        'location': {
                            'reference': location.id
                        }
                    });
                    this._self = genericLocationHandler(location);
                    this._self.prototype = proto;
                }
            } else {
                resource = findLastResourceOfType.call(proto.bundle.entry, 'Procedure');
                if (resource) {
                    procedure = resource.resource;
                    if (procedure) {
                        patient = findPatient(proto.bundle);

                        location = getResource('Location', {
                            'id': 'Location/' + (serial++).toString()
                        });
                        store2bundle(location, patient.id);

                        procedure.location = {
                            'reference': location.id
                        };
                        this._self = genericLocationHandler(location);
                        this._self.prototype = proto;
                    }
                }
            }
            break;
        }
    };

    if (contextId && _.contains(contextId, '2.16.840.1.113883.10.20.22.4.89')) { //Covered Party Participant
        claim = resource;
        //TODO process claim patient (it's defaulted to patient now)
    } else if (contextId && _.contains(contextId, '2.16.840.1.113883.10.20.22.4.90')) { //Policy Holder
        claim = resource;
        //TODO process claim.coverage.subscriber (it's defaulted to patient now)
    }

    this.playingEntity = function (node) {
        proto.control.push(new Triplet(node, new PlayingEntity(resource)));
    };

    this.playingDevice = function (node) {
        proto.control.push(new Triplet(node, new PlayingDevice(resource)));
    };

    this.id = function (node) {
        if (node.attributes.root) {
            ensureProperty.call(resource, 'identifier', true).push({
                'value': node.attributes.root
            });
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
ParticipantRole.prototype = proto;

var Participant = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
    };

    this.participantRole = function (node) {
        proto.control.push(new Triplet(node, new ParticipantRole(resource, templateId), templateId));
    };

};
Participant.prototype = proto;

var ObservationRangeValue = function (resource) {

    this.low = function (node) {
        resource.low = {
            'value': node.attributes.value,
            'unit': node.attributes.unit
        };

    };

    this.high = function (node) {
        resource.high = {
            'value': node.attributes.value,
            'unit': node.attributes.unit
        };
    };

};
ObservationRangeValue.prototype = proto;

var ObservationRange = function (resource) {

    this.value = function (node) {
        switch (node.attributes['xsi:type']) {
        case 'IVL_PQ':
            proto.control.push(new Triplet(node, new ObservationRangeValue(resource)));
            break;
        }
    };

    this.text$ = function (text) {
        resource.text = text;
    };

};
ObservationRange.prototype = proto;

var ReferenceRange = function (resource) {

    this.observationRange = function (node) {
        proto.control.push(new Triplet(node, new ObservationRange(resource)));
    };

};
ReferenceRange.prototype = proto;

var genericConditionHandler = function (condition, templateId) {
    var retval = {};
    switch (templateId) {
    case '2.16.840.1.113883.10.20.22.4.4':
        retval = {
            code: function (node) {
                condition.category = {
                    'coding': makeCode(node)
                };
            },
            effectiveTime: function (node) {
                if (node.attributes.value) {
                    condition.onsetDateTime = dateFix(node.attributes.value);
                } else {
                    condition.onsetPeriod = {};
                    proto.control.push(new Triplet(node, new EffectiveTime(null, condition.onsetPeriod), templateId));
                }
            },
            value: function (node) {
                condition.code = {
                    'coding': makeCode(node)
                };
            }
        };
        break;
    case '2.16.840.1.113883.10.20.22.4.6':
        retval = {
            value: function (node) {
                condition.clinicalStatus = (node.attributes.displayName) ? node.attributes.displayName : node.attributes.code;
            }
        };
        break;
    }
    retval.entryRelationship = function (node) {
        proto.control.push(new Triplet(node, new EntryRelationship(null, condition), templateId));
    };
    return retval;
};

var genericObservationHandler = function (observation, templateId) {
    return {
        // Move cognitive function resource (from tests) into social history resource
        // See https://github.com/amida-tech/dre-frontend/issues/42 
        templateId: function (node) {
            if ('2.16.840.1.113883.10.20.22.4.74' === node.attributes.root) {
                setSocialHistoryCategory(observation);
            }
        },
        id: function (node) {
            if (node.attributes.root) {
                ensureProperty.call(observation, 'identifier', true).push({
                    'value': node.attributes.root
                });
            }
        },
        code: function (node) {
            observation.code = {
                'coding': [makeCode(node)]
            };
        },
        statusCode: function (node) {
            observation.status = node.attributes.code;
        },
        effectiveTime: function (node) {
            if (node.attributes.value) {
                observation.effectiveDateTime = dateFix(node.attributes.value);
            } else {
                observation.effectivePeriod = {};
                proto.control.push(new Triplet(node, new EffectiveTime(null, observation.effectivePeriod), templateId));
            }
        },
        value: function (node) {
            switch (node.attributes['xsi:type']) {
            case 'PQ':
                observation.valueQuantity = {
                    'value': node.attributes.value,
                    'unit': node.attributes.unit
                };
                break;
            case 'CD':
                if (node.attributes.code) {
                    observation.valueCodeableConcept = {
                        'coding': [makeCode(node)]
                    };
                }
                break;
            }
        },
        value$: function (text) {
            if (!(observation.valueQuantity || observation.valueCodeableConcept)) {
                observation.valueString = text;
            }
        },
        interpretationCode: function (node) {
            observation.interpretation = {
                'coding': [
                    makeCode(node)
                ]
            };
        },
        referenceRange: function (node) {
            var referencerange = {};
            ensureProperty.call(observation, 'referenceRange', true).push(referencerange);
            proto.control.push(new Triplet(node, new ReferenceRange(referencerange), templateId));
        },
        targetSiteCode: function (node) {
            observation.bodySite = {
                'coding': [makeCode(node)]
            };
        },
        method: function (node) {
            if (node.attributes.code) {
                observation.method = {
                    'coding': [makeCode(node)]
                };
            }
        },
        performer: function (node) {
            var patient = findPatient(proto.bundle);
            var practitioner = {
                'resourceType': 'Practitioner',
                'id': 'Practitioner/' + (serial++).toString()
            };

            proto.bundle.entry.push({
                'resource': practitioner
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': practitioner.id
                }
            });
            ensureProperty.call(observation, 'performer', true).push({
                'reference': practitioner.id
            });
            proto.control.push(new Triplet(node, new Performer(practitioner), templateId));
        },
        participant: function (node) {
            proto.control.push(new Triplet(node, new Participant(observation), templateId));
        },
        entryRelationship: function (node) {
            proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, observation), templateId));
        }
    };
};

var Observation = function (classCode, resource, param1, bundle, composition) {
    var templateId = [];
    var familyMemberHistory;
    //var clinicalImpression;
    var condition;
    var last;
    var patient;

    this.templateId = function (node) {

        templateId.push(node.attributes.root);
        //Make it polymorphic
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.7': //Allergy observation
            var _allergyIntolerance = resource;
            var _event = param1;

            this._self = {

                effectiveTime: function (node) {
                    proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(_event, 'onset'), templateId));
                },
                value: function (node) {
                    var code = recodeAllergyReactionCode(node);
                    if (code.type) {
                        _allergyIntolerance.type = code.type;
                    }
                    if (code.category) {
                        _allergyIntolerance.category = code.category;
                    }
                    /*ensureProperty.call(_event, 'manifestation', true).push({
                        'coding': [
                            makeCode(node)
                        ]
                    });*/
                },
                participant: function (node) {
                    proto.control.push(new Triplet(node, new Participant(_allergyIntolerance), templateId));
                },
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationshipAllergyIntolerance(node.attributes.typeCode, _allergyIntolerance), templateId));
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.28': //Allergy status observation
            _allergyIntolerance = resource;

            this._self = {
                value: function (node) {
                    _allergyIntolerance.status = node.attributes.displayName;
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.9': //Reaction observation
            var event = param1;

            _allergyIntolerance = resource;
            this._self = {
                value: function (node) {
                    ensureProperty.call(event, 'manifestation', true).push({
                        'coding': [
                            makeCode(node)
                        ]
                    });
                },
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationshipAllergyIntolerance(node.attributes.typeCode, _allergyIntolerance), templateId));
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.8': //Severity observation
            event = param1;
            this._self = {
                value: function (node) {
                    var code = recodeSeverity(node);
                    event.severity = code.severity;
                    if (!resource.criritcality || resource.criticality === 'CRITU' || (resource.criticality === 'CRITL' && code.criticality === 'CRITH')) {
                        resource.criticality = code.criticality;
                    }
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.19': //MEDICATIONS / Indication /Encounter reason
            if (isInContextOf('2.16.840.1.113883.10.20.22.2.22.1')) { //Encounters section with entries required
                var encounter = resource;
                this._self = {
                    value: function (node) {
                        //TODO any other xsi:type ?
                        if (node.attributes['xsi:type'] === 'CD') {
                            ensureProperty.call(encounter, 'reason', true).push({
                                'coding': [makeCode(node)]
                            });
                        }
                    }
                };
                this._self.prototype = proto;
            } else {
                var _condition = resource;

                if (!_condition) { // Unattached
                    _condition = makeAndStoreObservation(findPatient(proto.bundle));
                }

                this._self = {
                    code: function (node) {
                        _condition.category = {
                            'coding': [makeCode(node)]
                        };

                    },

                    /*statusCode: function (node) {
                        //TODO recode to FHIR
                        _condition.clinicalStatus = node.attributes.code;
                    },*/

                    effectiveTime: function (node) {
                        var subType = node.attributes['xsi:type'];
                        switch (subType) {
                            //case 'IVL_TS':
                            default: // All the same for now
                                ensureProperty.call(_condition, 'onsetPeriod');
                            proto.control.push(new Triplet(node, new EffectiveTime(subType, _condition.onsetPeriod), templateId));
                            break;
                        }
                    },

                    value: function (node) {
                        //TODO any other xsi:type ?
                        if (node.attributes['xsi:type'] === 'CD') {
                            _condition.code = {
                                'coding': [makeCode(node)]
                            };
                        }
                    }
                };
                this._self.prototype = proto;
            }
            break;

        case '2.16.840.1.113883.10.20.22.4.53': // Immunization refusal
            var immunization = resource;
            this._self = {
                code: function (node) {
                    ensureProperty.call(immunization, 'explanation');
                    ensureProperty.call(immunization.explanation, 'reasonNotGiven', true).push({
                        'coding': [makeCode(node)]
                    });
                }
            };
            this._self.prototype = proto;

            break;
        case '2.16.840.1.113883.10.20.22.4.47': // Family history death observation
            familyMemberHistory = resource;
            this._self = {
                value: function (node) {
                    if (familyMemberHistory) {
                        last = _.last(ensureProperty.call(familyMemberHistory, 'condition', true));
                        if (last) {
                            if (node.attributes['xsi:type'] === 'CD') {
                                last.outcome = _.merge({
                                    'coding': [makeCode(node)]
                                }, last.outcome);
                            } else if (node.attributes.displayName) {
                                last.outcome = _.merge({
                                    'coding': [{
                                        'text': node.attributes.displayName
                                    }]
                                }, last.outcome);
                            }
                        }
                    }
                }
            };
            this._self.prototype = proto;

            break;
        case '2.16.840.1.113883.10.20.22.4.31': // Age observation (familyhistory)
            if (isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                condition = findLastResourceOfType.call(proto.bundle.entry, 'Condition');
                if (condition) {
                    this._self = {
                        code: function (node) {
                            condition.resource.onsetQuantity = _.merge(makeQuantity(node), condition.resource.onsetQuantity);
                        },
                        value: function (node) {
                            condition.resource.onsetQuantity = _.merge(valueFix(node), condition.resource.onsetQuantity);
                        }
                    };
                    this._self.prototype = proto;
                }
            } else if (isInContextOf('2.16.840.1.113883.10.20.22.4.46')) { // Family history observation

                familyMemberHistory = resource;
                if (familyMemberHistory) {
                    this._self = {
                        value: function (node) {
                            last = _.last(ensureProperty.call(familyMemberHistory, 'condition', true));
                            if (last) {
                                last.onsetQuantity = _.merge(valueFix(node), last.onsetQuantity);
                            }
                        },
                        code: function (node) {
                            last = _.last(ensureProperty.call(familyMemberHistory, 'condition', true));
                            if (last) {
                                last.onsetQuantity = _.merge(makeQuantity(node), last.onsetQuantity);
                            }
                        }
                    };
                    this._self.prototype = proto;
                }
            }
            break;
        case '2.16.840.1.113883.10.20.22.4.46': // Family history observation
            familyMemberHistory = resource;
            this._self = {
                value: function (node) {
                    if (param1) {
                        param1.code = {
                            'coding': [makeCode(node)]
                        };
                        if (familyMemberHistory && !_.contains(ensureProperty.call(familyMemberHistory, 'condition', true), param1)) {
                            familyMemberHistory.condition.push(param1);
                        }
                    }
                },
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, familyMemberHistory), templateId));
                }

            };
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.27': // Vital sign observation
            var observation = resource;
            this._self = genericObservationHandler(observation, templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.78': // Smoking status observation
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            this._self = genericObservationHandler(observation, templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.38': // Social history observation
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            setSocialHistoryCategory(observation);
            this._self = genericObservationHandler(observation, templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.2': // Result observation
            if (resource && resource.resourceType === 'ClinicalImpression') {
                observation = makeAndStoreObservation(findPatient(proto.bundle));
                ensureProperty.call(resource, 'investigations', true).push({
                    'code': {
                        'coding': [{
                            'system': 'http://snomed.info/sct',
                            'code': '160237006',
                            'display': 'History/symptoms'
                        }]
                    },
                    'item': [{
                        'reference': observation.id
                    }]
                });
            } else {
                observation = (resource) ? resource : makeAndStoreObservation(findPatient(proto.bundle));
            }
            //console.log(observation.resourceType);
            this._self = genericObservationHandler(observation, templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.13': // Procedure activity observation
            /*var procedure = findLastResourceOfType.call(proto.bundle.entry, 'Procedure');
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            if (procedure) {
                ensureProperty.call(procedure.resource, 'related', true).push({
                    'target': {
                        'reference': observation.id
                    }
                });
                this._self = genericObservationHandler(observation, templateId);
                this._self.prototype = proto;
            }
            break;*/
            this._self = genericProcedureHandlder(makeAndStore('Procedure', null, findPatient(proto.bundle)));
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.4': // Problem observation
            //console.log('>>>>',isInContextOf('2.16.840.1.113883.10.20.22.4.3'), resource);
            if (isInContextOf('2.16.840.1.113883.10.20.22.4.3')) { //Problem concern act
                condition = resource;

                /*observation = getResource('Observation', {
                        'id': 'Observation/' + (serial++).toString(),
                        'subject': {
                            'reference': condition.patient.reference
                        }
                    });
                    store2bundle(observation, condition.patient.reference);
    
                    ensureProperty.call(condition, 'stage');
                    ensureProperty.call(condition.stage, 'assessment', true).push({
                        'reference': observation.id
                    });*/
                this._self = genericConditionHandler(condition, '2.16.840.1.113883.10.20.22.4.4');
                this._self.prototype = proto;
            }
            break;

        case '2.16.840.1.113883.10.20.22.4.6': //Problem status observation
            if (isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                condition = resource;
                if (condition) {
                    this._self = genericConditionHandler(condition, '2.16.840.1.113883.10.20.22.4.6');
                    this._self.prototype = proto;
                }
            }
            break;

        case '2.16.840.1.113883.10.20.22.4.5': // Health status observation template
            if (isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                condition = resource;
                //condition = findLastResourceOfType.call(proto.bundle.entry, 'Condition');
                if (condition) {
                    this._self = genericConditionHandler(condition, '2.16.840.1.113883.10.20.22.4.5');
                    this._self.prototype = proto;
                }
            }
            break;

        case '2.16.840.1.113883.10.20.22.4.44': //Plan of care activity observation
            var carePlan = resource;
            patient = findPatient(proto.bundle);
            //var procedureRequest = getResource('ProcedureRequest', {
            // Convert to procedure
            var procedureRequest = getResource('Procedure', {
                'id': 'Procedure/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            store2bundle(procedureRequest, patient.id);

            if (carePlan) {
                ensureProperty.call(carePlan, 'activity', true).push({
                    'reference': {
                        'reference': procedureRequest.id
                    }
                });
            }
            this._self = {
                code: function (node) {
                    procedureRequest.code = {
                        'coding': [makeCode(node)]
                    };
                },
                statusCode: function (node) {
                    procedureRequest.status = node.attributes.code;
                },
                effectiveTime: function (node) {
                    //procedureRequest.scheduledDateTime = {};
                    //proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'scheduledDateTime'), templateId));
                    procedureRequest.effectiveTime = {};
                    proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'effectiveTime'), templateId));
                }
            };
            this._self.prototype = proto;
            break;

        }

    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Observation.prototype = proto;

var Product = function (medicationOrder) {
    var patient = findPatient(proto.bundle);

    this.manufacturedProduct = function (node) {

        var medication = getResource('Medication', {
            'id': 'Medication/' + (serial++).toString()
        });
        store2bundle(medication, patient.id);

        medicationOrder.medicationReference = {
            'reference': medication.id
        };
        proto.control.push(new Triplet(node, new ManufacturedProduct(medication)));
    };
};
Product.prototype = proto;

var Author = function (medicationOrder) {
    var patient = findPatient(proto.bundle);

    this.assignedAuthor = function (node) {

        var practitioner = getResource('Practitioner', {
            'id': 'Practitioner/' + (serial++).toString()
        });
        store2bundle(practitioner, patient.id);

        medicationOrder.prescriber = {
            'reference': practitioner.id
        };
        proto.control.push(new Triplet(node, new AssignedEntity(practitioner)));
    };

};
Author.prototype = proto;

var Supply = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        var patient;

        templateId.push(node.attributes.root);

        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.17':

            var medicationOrder;
            if (!resource.prescription) {
                patient = findPatient(proto.bundle);

                medicationOrder = getResource('MedicationOrder', {
                    'id': 'MedicationOrder/' + (serial++).toString()
                });
                store2bundle(medicationOrder, patient.id);

                resource.medicationOrder = {
                    'reference': medicationOrder.id
                };
            }
            if (!medicationOrder) {
                medicationOrder = findResource.call(proto.bundle.entry, resource.prescription.reference);
            }

            this._self = {

                statusCode: function (node) {
                    // TODO Recode?
                    medicationOrder.status = node.attributes.code;
                },

                effectiveTime: function (node) {
                    var subType = node.attributes['xsi:type'];
                    switch (subType) {
                    case 'IVL_TS':
                        ensureProperty.call(ensureProperty.call(medicationOrder, 'dispenseRequest'), 'validityPeriod');
                        proto.control.push(new Triplet(node, new EffectiveTime(subType, medicationOrder.dispenseRequest.validityPeriod)));
                        break;
                    default:
                        proto.control.push(new Triplet(node, dummy));
                        break;
                    }
                },

                repeatNumber: function (node) {
                    ensureProperty.call(medicationOrder, 'dispenseRequest').numberOfRepeatsAllowed = Number(node.attributes.value);
                },

                quantity: function (node) {
                    ensureProperty.call(medicationOrder, 'dispenseRequest').quantity = {
                        'value': Number(node.attributes.value)
                    };
                },

                product: function (node) {
                    proto.control.push(new Triplet(node, new Product(medicationOrder)));
                },

                /* TODO Find out semantic of this
                this.performer = function(node) {
                };*/

                author: function (node) {
                    proto.control.push(new Triplet(node, new Author(medicationOrder)));
                },

                /* TODO Wrapper for additional instructions
                this.entryRelationship = function(node) {
                };*/
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.50': //Non-medicinal supply activity

            // No Device generation
            proto.control.push(new Triplet(node, dummy));
            /*patient = findPatient(proto.bundle);

            var device = getResource('Device', {
                'id': 'Device/' + (serial++).toString(),
                "patient": {
                    "reference": patient.id
                }
            });
            store2bundle(device, patient.id);

            this._self = {
                statusCode: function (node) {
                    if (node.attributes.code) {
                        device.status = (node.attributes.code === 'completed') ? 'available' : 'not-available'; //TODO recode
                    }
                },
                participant: function (node) {
                    proto.control.push(new Triplet(node, new Participant(device)));
                },
            };
            this._self.prototype = proto;*/
            break;
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Supply.prototype = proto;

var genericProcedureHandlder = function (procedure) {
    if (!procedure) {
        console.log(JSON.stringify(proto.control, null, ' '));
    }
    return {
        id: function (node) {
            {
                ensureProperty.call(procedure, 'identifier', true).push({
                    'value': node.attributes.root
                });
            }
        },
        code: function (node) {
            procedure.code = {
                'coding': [makeCode(node)]
            };
        },
        statusCode: function (node) {
            procedure.status = node.attributes.code;
        },
        effectiveTime: function (node) {
            procedure.performedDateTime = dateFix(node.attributes.value);
        },
        targetSiteCode: function (node) {
            ensureProperty.call(procedure, 'bodySite', true).push({
                'coding': [makeCode(node)]
            });
        },
        specimen: function (node) {
            //TODO how to make a logical link between procedure and specimen?
        },
        performer: function (node) {
            proto.control.push(new Triplet(node, new Performer(procedure)));
        },
        participant: function (node) {
            var patient = findPatient(proto.bundle);

            var device = getResource('Device', {
                'id': 'Device/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(device, patient.id);

            ensureProperty.call(procedure, 'used', true).push({
                'reference': device.id
            });
            proto.control.push(new Triplet(node, new Participant(device)));
        }
    };
};

var Procedure = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.14': //Procedure activity procedure
            this._self = genericProcedureHandlder(resource);
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.41': //Plan of care activity procedure
            var carePlan = resource;
            var patient = findPatient(proto.bundle);

            //var procedureRequest = getResource('ProcedureRequest', {
            // Convert to procedure
            var procedureRequest = getResource('Procedure', {
                'id': 'Procedure/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            store2bundle(procedureRequest, patient.id);
            if (carePlan) { //ProcedureRequest which is a part of CarePlan 
                ensureProperty.call(carePlan, 'activity', true).push({
                    'reference': {
                        'reference': procedureRequest.id
                    }
                });
            }
            this._self = {
                code: function (node) {
                    procedureRequest.code = {
                        'coding': [makeCode(node)]
                    };
                },
                statusCode: function (node) {
                    procedureRequest.status = node.attributes.code;
                },
                effectiveTime: function (node) {
                    //procedureRequest.scheduledDateTime = {};
                    //proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'scheduledDateTime'), templateId));
                    procedureRequest.effectiveTime = {};
                    proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'effectiveTime'), templateId));
                }
            };
            this._self.prototype = proto;
            break;

        default:
            this._self = genericProcedureHandlder(resource);
            this._self.prototype = proto;
            break;
        }
    };

    if (isInContextOf('2.16.840.1.113883.10.20.1.19')) {
        this.code = function (node) {
            resource.service = makeCode(node);
        };
    } else {
        this.code = function (node) {
            resource.code = {
                'coding': [makeCode(node)]
            };
        };
    }
    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
Procedure.prototype = proto;

var EntryRelationshipMedication = function (typeCode, medicationAdministration) {
    var _medicationAdministration = medicationAdministration;

    this.observation = function (node) {
        var _patient = findPatient(proto.bundle);

        var condition = getResource('Condition', {
            'id': 'Condition/' + (serial++).toString(),
            'patient': {
                'reference': _patient.id
            }
        });
        store2bundle(condition, _patient.id);

        var medicationOrder = findResource.call(proto.bundle.entry, _medicationAdministration.prescription.reference);
        if (medicationOrder) {
            medicationOrder.reasonReference = {
                'reference': condition.id
            };
        }

        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, condition, null)));
    };

    this.supply = function (node) {

        proto.control.push(new Triplet(node, new Supply(medicationAdministration)));
    };

};
EntryRelationshipMedication.prototype = proto;

var EntryRelationshipAllergyIntolerance = function (typeCode, allergyIntolerance) {

    this.observation = function (node) {
        var event = ensureProperty.call(allergyIntolerance, 'reaction', true);
        if (event.length === 0) {
            event.push({});
        }
        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, allergyIntolerance, allergyIntolerance.reaction[0])));
    };

};
EntryRelationshipAllergyIntolerance.prototype = proto;

var EntryRelationship = function (typeCode, resource) {

    this.observation = function (node) {
        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, resource)));
    };

    this.act = function (node) {
        proto.control.push(new Triplet(node, new Act(resource)));
    };

    this.procedure = function (node) {
        proto.control.push(new Triplet(node, new Procedure(resource)));
    };

};
EntryRelationship.prototype = proto;

var SubstanceAdministration = function () {
    var patient = findPatient(proto.bundle);
    var templateId = [];
    var substanceAdministration;

    function getDosage() {
        var dosage;
        if (_.isArray(this.dosage)) {
            dosage = _.last(this.dosage);
            if (!dosage) {
                dosage = {
                    /*'schedule': {
                        'repeat': {}
                    }*/
                };
                this.dosage.push(dosage);
            }
        } else {
            dosage = this.dosage;
        }
        return dosage;
    }

    this.templateId = function (node) {
        templateId.push(node.attributes.root);

        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.52': //Immunization activity

            var immunization = getResource('Immunization', {
                'id': 'Immunization/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(immunization, patient.id);

            substanceAdministration = _.findLast(proto.control, function (value) {
                return value.node.name === 'substanceAdministration';
            });
            if (substanceAdministration && substanceAdministration.node.attributes.negationInd === 'true') {
                immunization.wasNotGiven = true;
            }

            this._self = {
                statusCode: function (node) {
                    //immunization.status = node.attributes.code;
                },
                effectiveTime: function (node) {
                    var subType = node.attributes['xsi:type'];
                    switch (subType) {
                    case 'IVL_TS':
                        if (node.attributes.value) {
                            immunization.date = dateFix(node.attributes.value);
                        }
                        break;
                    default:
                        proto.control.push(new Triplet(node, dummy, templateId));
                        break;
                    }
                },
                routeCode: function (node) {
                    immunization.route = {
                        'coding': [makeCode(node)]
                    };
                },
                doseQuantity: function (node) {
                    immunization.doseQuantity = {
                        'value': Number(node.attributes.value),
                        'unit': node.attributes.unit
                    };
                },
                consumable: function (node) {
                    proto.control.push(new Triplet(node, new Consumable(immunization), templateId));
                },

                performer: function (node) {
                    proto.control.push(new Triplet(node, new Performer(immunization), templateId));
                },

                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, immunization), templateId));
                },
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.16': //Medication activity

            var _medicationOrder = getResource('MedicationOrder', {
                'id': 'MedicationOrder/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                },
                'dosageInstruction': []
            });
            store2bundle(_medicationOrder, patient.id);

            var _medicationAdministration = getResource('MedicationAdministration', {
                'id': 'MedicationAdministration/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                },
                'prescription': {
                    'reference': _medicationOrder.id
                },
                'dosage': {}
            });
            store2bundle(_medicationAdministration, patient.id);

            substanceAdministration = _.findLast(proto.control, function (value) {
                return value.node.name === 'substanceAdministration';
            });
            if (substanceAdministration && substanceAdministration.node.attributes.negationInd === 'true') {
                _medicationAdministration.wasNotGiven = true;
            }

            this._self = {

                statusCode: function (node) {
                    _medicationAdministration.status = node.attributes.code;
                },

                effectiveTime: function (node) {
                    var subType = node.attributes['xsi:type'];
                    switch (subType) {
                    case 'IVL_TS':
                        if (node.attributes.value) {
                            _medicationAdministration.effectiveTimeDateTime = dateFix(node.attributes.value);
                        } else {
                            proto.control.push(new Triplet(node, new EffectiveTime(subType, ensureProperty.call(_medicationAdministration, 'effectiveTimePeriod'), templateId)));
                        }
                        break;
                    case 'PIVL_TS':
                        var timing = {
                            'timing': {
                                'repeat': {}
                            }
                        };
                        _medicationOrder.dosageInstruction.push(timing);
                        proto.control.push(new Triplet(node, new EffectiveTime(subType, timing), templateId));
                        break;
                    default:
                        proto.control.push(new Triplet(node, dummy, templateId));
                        break;
                    }
                },

                routeCode: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.route = {
                        'coding': [makeCode(node)]
                    };
                },

                doseQuantity: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.quantity = {
                        'value': Number(node.attributes.value),
                        'unit': node.attributes.unit
                    };
                },

                rateQuantity: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.rateRatio = {
                        'numerator': {
                            'value': Number(node.attributes.value),
                            'unit': node.attributes.unit
                        },
                        'denominator': {
                            'value': 1
                        }
                    };
                },

                maxDoseQuantity: function (node) {
                    if (node.attributes.nullFlavor) {
                        proto.control.push(new Triplet(node, dummy, templateId));
                    } else {
                        proto.control.push(new Triplet(node, dummy, templateId)); //TODO make dose quanty parser
                    }
                },

                administrationUnitCode: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.method = {
                        'coding': [makeCode(node)]
                    };
                },

                consumable: function (node) {
                    proto.control.push(new Triplet(node, new Consumable(_medicationAdministration, [function (medId) {
                        _medicationOrder.medicationReference = {
                            'reference': medId
                        };
                    }]), templateId));
                },

                performer: function (node) {
                    proto.control.push(new Triplet(node, new Performer(_medicationAdministration), templateId));
                },

                //TODO this.participant - unclear mapping
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationshipMedication(node.attributes.typeCode, _medicationAdministration), templateId));
                },

                //Possible allergic reactions
                act: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationshipMedication(node.attributes.typeCode, _medicationAdministration), templateId));
                }

            };
            this._self.prototype = proto;

            break;
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
SubstanceAdministration.prototype = proto;

var Act = function (resource) {
    var templateId = [];
    var claim;

    this.templateId = function (node) {
        var patient;
        templateId.push(node.attributes.root);

        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.30':
            var allergyIntolerance = resource; //alias
            this._self = {
                statusCode: function (node) {
                    //TODO recode
                    allergyIntolerance.status = node.attributes.code;
                },

                effectiveTime: function (node) {
                    //TODO effective time type???
                    allergyIntolerance.lastOccurence = dateFix(node.attributes.value);
                },

                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationshipAllergyIntolerance(node.attributes.typeCode, allergyIntolerance), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.60': //Coverage activity
            claim = resource;

            this._self = {
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, claim), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.61': //Policy activity
            claim = resource;

            this._self = {
                performer: function (node) {
                    proto.control.push(new Triplet(node, new Performer(claim), templateId));
                },
                participant: function (node) {
                    proto.control.push(new Triplet(node, new Participant(claim), templateId));
                },
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, claim), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.1.19': //Authorization activity
            claim = resource;
            this._self = {
                entryRelationship: function (node) {
                    var procedure = {};
                    ensureProperty.call(claim, 'item', true).push(procedure);
                    procedure.sequence = claim.item.length;
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, procedure), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.3': //Problem concern act
            var clinicalImpression = resource;
            patient = findPatient(proto.bundle);

            var condition = getResource('Condition', {
                'id': 'Condition/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(condition, patient.id);

            this._self = {
                entryRelationship: function (node) {
                    if (clinicalImpression) {
                        ensureProperty.call(clinicalImpression, 'problem', true).push({
                            'reference': condition.id
                        });
                    }
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, condition), templateId));

                },
                id: function (node) {
                    if (node.attributes.root) {
                        ensureProperty.call(condition, 'identifier', true).push({
                            'value': node.attributes.root
                        });
                    }
                },
                code: function (node) {
                    condition.code = {
                        'coding': [makeCode(node)]
                    };
                },
                statusCode: function (node) {
                    condition.clinicalStatus = node.attributes.code;
                },
                effectiveTime: function (node) {
                    condition.onsetPeriod = {};
                    proto.control.push(new Triplet(node, new EffectiveTime(null, condition.onsetPeriod), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.39':
            var carePlan = resource;
            patient = findPatient(proto.bundle);

            //var procedureRequest = getResource('ProcedureRequest', {
            //Convert to procedure
            var procedureRequest = getResource('Procedure', {
                //'id': 'ProcedureRequest/' + (serial++).toString(),
                'id': 'Procedure/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            store2bundle(procedureRequest, patient.id);

            if (carePlan) {
                ensureProperty.call(carePlan, 'activity', true).push({
                    'reference': {
                        'reference': procedureRequest.id
                    }
                });
            }
            this._self = {
                code: function (node) {
                    procedureRequest.code = {
                        'coding': [makeCode(node)]
                    };
                },
                statusCode: function (node) {
                    procedureRequest.status = node.attributes.code;
                },
                effectiveTime: function (node) {
                    //procedureRequest.scheduledDateTime = {};
                    //proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'scheduledDateTime'), templateId));
                    procedureRequest.effectiveTime = {};
                    proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'effectiveTime'), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        }

    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Act.prototype = proto;

var RelatedSubject = function (familyMemberHistory) {

    this.code = function (node) {
        familyMemberHistory.relationship = [{
            'coding': [makeCode(node)]
        }];
    };

    this.subject = function (node) {
        proto.control.push(new Triplet(node, new Subject(familyMemberHistory)));
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
RelatedSubject.prototype = proto;

var DeepCodeExtractor = function (codes) {
    this.translation = function (node) {
        codes.coding.push(makeCode(node));
    };
};
DeepCodeExtractor.prototype = proto;

var Encounter = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        var patient;
        templateId.push(node.attributes.root);
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.40': //Plan of care activity encounter
            var carePlan = resource;
            patient = findPatient(proto.bundle);

            //var procedureRequest = getResource('ProcedureRequest', {
            // Convert to procedure
            var procedureRequest = getResource('Procedure', {
                'id': 'Procedure/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            store2bundle(procedureRequest, patient.id);

            if (carePlan) {
                ensureProperty.call(carePlan, 'activity', true).push({
                    'reference': {
                        'reference': procedureRequest.id
                    }
                });
            }
            this._self = {
                code: function (node) {
                    procedureRequest.code = {
                        'coding': [makeCode(node)]
                    };
                },
                statusCode: function (node) {
                    procedureRequest.status = node.attributes.code;
                },
                effectiveTime: function (node) {
                    //procedureRequest.scheduledDateTime = {};
                    //proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'scheduledDateTime'), templateId));
                    procedureRequest.effectiveTime = {};
                    proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'effectiveTime'), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.49': //Encounter activities
            patient = findPatient(proto.bundle);

            var encounter = getResource('Encounter', {
                'id': 'Encounter/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(encounter, patient.id);

            //ensureProperty.call(carePlencounteran, 'activity',true).push({'reference':procedureRequest.id});
            this._self = {
                id: function (node) {
                    if (node.attributes.root) {
                        ensureProperty.call(encounter, 'identifier', true).push({
                            'value': node.attributes.root
                        });
                    }
                },
                code: function (node) {
                    encounter.type = [{
                        'coding': [makeCode(node)]
                    }];
                    proto.control.push(new Triplet(node, new DeepCodeExtractor(encounter.type[encounter.type.length - 1]), templateId));
                },
                effectiveTime: function (node) {
                    if (node.attributes.value) {
                        encounter.period = _.merge({}, encounter.period);
                        encounter.period.start = dateFix(node.attributes.value);
                        encounter.period.end = encounter.period.start;
                    }
                },
                participant: function (node) {
                    proto.control.push(new Triplet(node, new Participant(encounter), templateId));
                },
                performer: function (node) {
                    proto.control.push(new Triplet(node, new Performer(encounter), templateId));
                },
                entryRelationship: function (node) {
                    proto.control.push(new Triplet(node, new EntryRelationship(null /* scheduled to remove */ , encounter), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
Encounter.prototype = proto;

var Subject = function (familyMemberHistory) {

    this.relatedSubject = function (node) {
        proto.control.push(new Triplet(node, new RelatedSubject(familyMemberHistory)));
    };

    this['sdtc:id'] = function (node) {
        if (node.attributes.root === '2.16.840.1.113883.19.5.99999.2') {
            this._self = {
                administrativeGenderCode: function (node) {
                    familyMemberHistory.gender = recodeGender(node.attributes.code);
                },
                birthTime: function (node) {
                    familyMemberHistory.bornDate = dateFix(node.attributes.value);
                }
            };
            this._self.prototype = proto;
        } else {
            proto.control.push(new Triplet(node, dummy)); // Have no idea what is this
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
Subject.prototype = proto;

//The Family History Oranizer associates a set of observations with a family member.
var Organizer = function () {
    var templateId = [];
    var resource;
    var patient = findPatient(proto.bundle);

    this.templateId = function (node) {
        //console.log('>>>>>',node.attributes.root);
        templateId.push(node.attributes.root);
    };

    this.subject = function (node) {
        if (_.contains(templateId, '2.16.840.1.113883.10.20.22.4.45')) {

            // Decided not to process FamilyMemberHistory
            proto.control.push(new Triplet(node, dummy, templateId));
            /*var familyMemberHistory = getResource('FamilyMemberHistory', {
                'id': 'FamilyMemberHistory/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(familyMemberHistory, patient.id);

            proto.control.push(new Triplet(node, new Subject(familyMemberHistory), templateId));
            resource = familyMemberHistory;*/
        }
    };

    this.component = function (node) {
        var observation;
        var familyHistoryOrganizer = ['2.16.840.1.113883.10.20.22.4.45'];
        var vitalSignsOrganizer = ['2.16.840.1.113883.10.20.22.4.26'];
        var genericResultOrganizer = ['2.16.840.1.113883.10.20.22.4.1'];
        var functionaStatusResultOrganizer = ['2.16.840.1.113883.10.20.22.4.66'];
        var resultsOrganizer = ['2.16.840.1.113883.10.20.22.2.3', '2.16.840.1.113883.10.20.22.2.3.1'];
        var functionalStatusSection = ['2.16.840.1.113883.10.20.22.2.14'];
        if (_.any(templateId, function (value) {
                return _.contains(familyHistoryOrganizer, value);
            }) || isInContextOf(familyHistoryOrganizer)) { //Family history organizer
            proto.control.push(new Triplet(node, new Component(resource), templateId));
        } else if (_.any(templateId, function (value) {
                return _.contains(resultsOrganizer, value);
            }) || isInContextOf(resultsOrganizer)) { //Results section with entries optional
            observation = makeAndStore('Observation', null, patient);
            proto.control.push(new Triplet(node, new Component(observation), templateId));
        } else if (_.any(templateId, function (value) {
                return _.contains(vitalSignsOrganizer, value);
            }) || isInContextOf(vitalSignsOrganizer)) { //Vital signs organizer

            observation = getResource('Observation', {
                'id': 'Observation/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            store2bundle(observation, patient.id);

            proto.control.push(new Triplet(node, new Component(observation), templateId));
        } else if (_.any(templateId, function (value) {
                return _.contains(genericResultOrganizer, value);
            }) && isInContextOf(functionalStatusSection)) { //Functional status section

            // Do not create ClinicalImpression
            proto.control.push(new Triplet(node, new Component(null), templateId));
            /*var clinicalImpression = getResource('ClinicalImpression', {
                'id': 'ClinicalImpression/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(clinicalImpression, patient.id);

            proto.control.push(new Triplet(node, new Component(clinicalImpression), templateId));*/
        }
    };
};
Organizer.prototype = proto;

var Entry = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
    };

    //MEDICATIONS or IMMUNIZATIONS, depend on templateId
    this.substanceAdministration = function (node) {
        proto.control.push(new Triplet(node, new SubstanceAdministration(), templateId));
    };

    //Allergies, Adverse Reactions, Alerts
    this.act = function (node) {
        var patient;
        var allergiesSection_Entries_Optional = '2.16.840.1.113883.10.20.22.2.6';
        var allergiesSection_Entries_Required = '2.16.840.1.113883.10.20.22.2.6.1';
        var allergiesSection = [allergiesSection_Entries_Optional, allergiesSection_Entries_Required];
        if (isInContextOf(allergiesSection)) {
            patient = findPatient(proto.bundle);

            var allergyIntolerance = getResource('AllergyIntolerance', {
                'id': 'AllergyIntolerance/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(allergyIntolerance, patient.id);

            proto.control.push(new Triplet(node, new Act(allergyIntolerance), templateId));

        } else if (isInContextOf('2.16.840.1.113883.10.20.22.2.18')) {

            patient = findPatient(proto.bundle);

            var claim = getResource('Claim', {
                'id': 'Claim/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(claim, patient.id);

            proto.control.push(new Triplet(node, new Act(claim), templateId));
        } else if (isInContextOf('2.16.840.1.113883.10.20.22.2.5') || isInContextOf('2.16.840.1.113883.10.20.22.2.5')) {
            //conforms to Problems section with entries optional
            //Problems section with entries required

            // Do not create ClinicalImpression
            proto.control.push(new Triplet(node, new Act(resource), templateId));
            /*if (!resource || resource.resourceType !== 'ClinicalImpression') {
                patient = findPatient(proto.bundle);

                var clinicalImpression = getResource('ClinicalImpression', {
                    'id': 'ClinicalImpression/' + (serial++).toString(),
                    'patient': {
                        'reference': patient.id
                    }
                });
                store2bundle(clinicalImpression, patient.id);

                proto.control.push(new Triplet(node, new Act(clinicalImpression), templateId));
            } else {
                proto.control.push(new Triplet(node, new Act(resource), templateId));
            }*/
        } else {
            proto.control.push(new Triplet(node, new Act(resource), templateId));
        }
    };

    //Part of FAIMLY HSTORY
    this.organizer = function (node) {
        proto.control.push(new Triplet(node, new Organizer(), templateId));
    };

    this.supply = function (node) {
        proto.control.push(new Triplet(node, new Supply(resource), templateId));
    };

    this.observation = function (node) {
        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, resource), templateId));
    };

    this.encounter = function (node) {
        proto.control.push(new Triplet(node, new Encounter(resource), templateId));
    };

    this.procedure = function (node) {
        var proceduresSectionEntriesOptional = '2.16.840.1.113883.10.20.22.2.7';
        var proceduresSectionEntriesRequired = '2.16.840.1.113883.10.20.22.2.7.1';
        if (isInContextOf([proceduresSectionEntriesOptional, proceduresSectionEntriesRequired])) {
            var patient = findPatient(proto.bundle);

            var procedure = makeAndStore('Procedure', null, patient);

            proto.control.push(new Triplet(node, new Procedure(procedure), templateId));
        } else {
            proto.control.push(new Triplet(node, new Procedure(resource), templateId));
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Entry.prototype = proto;

var Section = function (resource) {
    var templateId = [];
    var patient;

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.2.10': //Plan of care section
            patient = findPatient(proto.bundle);

            //Don't make care plan
            //resource = makeAndStore('CarePlan', null, patient);

            break;
        case '2.16.840.1.113883.10.20.22.2.5.1': //CCDA Active Problems Section (Entries Required)
            //Do not create CliniacalImpression

            /*patient = findPatient(proto.bundle); //Try to keep things organized

            resource = getResource('ClinicalImpression', {
                'id': 'ClinicalImpression/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(resource, patient.id);*/

            break;
        case '2.16.840.1.113883.10.20.22.2.25': //CCDA Procedure Note
            patient = findPatient(proto.bundle);

            resource = getResource('Procedure', {
                'id': 'Procedure/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });
            store2bundle(resource, patient.id);

            break;
        case '2.16.840.1.113883.10.20.22.2.30': //CCDA Planned Procedure
            //Do nothing specific

            break;
        }
    };

    this.entry = function (node) {
        proto.control.push(new Triplet(node, new Entry(resource), templateId));
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Section.prototype = proto;

var StructuredBody = function (resource) {

    this.component = function (node) {
        proto.control.push(new Triplet(node, new Component(resource)));
    };

};
StructuredBody.prototype = proto;

var Component = function (resource) {

    this.structuredBody = function (node) {
        proto.control.push(new Triplet(node, new StructuredBody(resource)));
    };

    this.section = function (node) {
        proto.control.push(new Triplet(node, new Section(resource)));
    };

    this.observation = function (node) {
        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, resource, {})));
    };

};
Component.prototype = proto;

var Name = function (name) {
    var _name = name;

    this.given$ = function (text) {
        if (!_name.given) {
            _name.given = [];
        }
        _name.given.push(text);
    };

    this.family$ = function (text) {
        if (!_name.family) {
            _name.family = [];
        }
        _name.family.push(text);
    };
};
Name.prototype = proto;

var SomeWithName = function (some) {
    var _some = some;

    this.name = function (node) {
        if (!_some.name) {
            _some.name = [];
        }
        var name = {};
        if (node.attributes.use) {
            name.use = recodeNameUse(node.attributes.use);
        }
        _some.name.push(name);

        proto.control.push(new Triplet(node, new Name(name)));
    };

    /*this.name = function (node) {
        if (!_some.name) {
            _some.name = {};
        }
        if (node.attributes.use) {
            _some.name.use = recodeNameUse(node.attributes.use);
        }

        proto.control.push(new Triplet(node, new Name(_some.name)));
    };*/
};
SomeWithName.prototype = proto;

var SomeWithSingleName = function (some) {
    var _some = some;

    this.name = function (node) {
        if (!_some.name) {
            _some.name = {};
        }
        if (node.attributes.use) {
            _some.name.use = recodeNameUse(node.attributes.use);
        }

        proto.control.push(new Triplet(node, new Name(_some.name)));
    };
};
SomeWithSingleName.prototype = proto;

var Place = function (address) {
    var _address = address;

    this.addr = function (node) {
        proto.control.push(new Triplet(node, new Addr(_address)));
    };
};
Place.prototype = proto;

var BirthPlace = function (address) {
    var _address = address;

    this.place = function (node) {
        proto.control.push(new Triplet(node, new Place(_address)));
    };
};
BirthPlace.prototype = proto;

var LanguageCommunication = function (communication) {
    var _communication = communication;

    this.languageCode = function (node) {
        _communication.language = {
            'coding': [{
                'code': node.attributes.code
            }]
        };
    };

    this.preferenceInd = function (node) {
        _communication.preferred = node.attributes.value;
    };
};
LanguageCommunication.prototype = proto;

var GuardianPerson = function (contact) {
    SomeWithName.call(this, contact);
};
GuardianPerson.prototype = new SomeWithName(null);

var Guardian = function (contact) {

    this.code = function (node) {
        contact.relationship = [{
            'coding': [{
                'system': 'urn:oid:' + node.attributes.codeSystem,
                'code': node.attributes.code,
                'display': node.attributes.displayName
            }]
        }];
    };

    this.addr = function (node) {
        contact.address = {};
        proto.control.push(new Triplet(node, new Addr(contact.address)));
    };

    this.telecom = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(contact, 'telecom', true).push(recodeTelecom(node));
    };

    this.guardianPerson = function (node) {
        proto.control.push(new Triplet(node, new GuardianPerson(contact)));
    };

};
Guardian.prototype = proto;

var Patient = function (patient) {
    SomeWithName.call(this, patient);

    var _patient = patient;

    this.administrativeGenderCode = function (node) {
        _patient.gender = recodeGender(node.attributes.code);
    };

    this.birthTime = function (node) {
        _patient.birthDate = dateFix(node.attributes.value);
    };
    this.maritalStatusCode = function (node) {
        _patient.maritalStatus = {
            coding: [makeCode(node)]
        };
    };
    this.religiousAffiliationCode = function (node) {
        ensureProperty.call(_patient, 'extension', true).push({
            'url': 'http://hl7.org/fhir/StructureDefinition/us-core-religion',
            'valueCodeableConcept': {
                'coding': [{
                    'system': 'urn:oid:' + node.attributes.codeSystem,
                    'code': node.attributes.code,
                    'display': node.attributes.displayName
                }]
            }
        });
    };
    this.raceCode = function (node) {
        ensureProperty.call(_patient, 'extension', true).push({
            'url': 'http://hl7.org/fhir/StructureDefinition/us-core-race',
            'valueCodeableConcept': {
                'coding': [{
                    'system': 'urn:oid:' + node.attributes.codeSystem,
                    'code': node.attributes.code,
                    'display': node.attributes.displayName
                }]
            }
        });
    };
    this.ethnicGroupCode = function (node) {
        ensureProperty.call(_patient, 'extension', true).push({
            'url': 'http://hl7.org/fhir/StructureDefinition/us-core-ethnicity',
            'valueCodeableConcept': {
                'coding': [{
                    'system': 'urn:oid:' + node.attributes.codeSystem,
                    'code': node.attributes.code,
                    'display': node.attributes.displayName
                }]
            }
        });
    };

    this.guardian = function (node) {
        var contact = {};
        ensureProperty.call(_patient, 'contact', true).push(contact);
        proto.control.push(new Triplet(node, new Guardian(contact)));
    };

    this.birthplace = function (node) {
        var address = {};
        ensureProperty.call(_patient, 'extension', true).push({
            'url': 'http://hl7.org/fhir/StructureDefinition/birthPlace',
            'valueAddress': address
        });
        proto.control.push(new Triplet(node, new BirthPlace(address)));
    };
    this.languageCommunication = function (node) {
        var communication = {};
        ensureProperty.call(_patient, 'communication', true).push(communication);
        proto.control.push(new Triplet(node, new LanguageCommunication(communication)));
    };
};
Patient.prototype = new SomeWithName(null);

var AssignedPerson = function (patient) {
    SomeWithSingleName.call(this, patient);
};
AssignedPerson.prototype = new SomeWithSingleName(null);

var Addr = function (address_) {
    var address = address_;

    this.streetAddressLine$ = function (text) {
        if (!address.line) {
            address.line = [];
        }
        address.line.push(text);
    };

    this.city$ = function (text) {
        address.city = text;
    };

    this.state$ = function (text) {
        address.state = text;
    };

    this.postalCode$ = function (text) {
        address.postalCode = text;
    };

    this.country$ = function (text) {
        address.country = text;
    };

};
Addr.prototype = proto;

var PatientRole = function (patient) {
    var _patient = patient;

    this.id = function (node) {
        if (node.attributes.root) {
            if (!_patient.identifier) {
                _patient.identifier = [];
            }
            _patient.identifier.push({
                'system': 'urn:oid:' + node.attributes.root,
                'value': node.attributes.extension
            });
        }
    };

    this.addr = function (node) {
        var address = {};
        if (node.attributes.use) {
            address.use = recodeAddrUse(node.attributes.use);
        }
        if (!_patient.address) {
            _patient.address = [address];
        }
        proto.control.push(new Triplet(node, new Addr(address)));
    };

    this.telecom = function (node) {
        if (node.attributes.nullFlavor) {
            return;
        }
        ensureProperty.call(_patient, 'telecom', true).push(recodeTelecom(node));
    };

    this.patient = function (node) {
        proto.control.push(new Triplet(node, new Patient(_patient)));
    };

    this.providerOrganization = function (node) {

        var organization = getResource('Organization', {
            'id': 'Organization/' + (serial++).toString()
        });
        store2bundle(organization, _patient.id);

        _patient.managingOrganization = {
            'reference': organization.id
        };
        proto.control.push(new Triplet(node, new Organization(organization)));
    };
};
PatientRole.prototype = proto;

var RecordTarget = function (patient) {

    this.patientRole = function (node) {
        proto.control.push(new Triplet(node, new PatientRole(patient)));
    };
};
RecordTarget.prototype = proto;

var ClinicalDocument = function (patientId, parserStream) {
    var templateId = [];

    this.patientId = patientId;

    proto.bundle = {
        'resourceType': 'Bundle'
    };

    proto.composition = {
        'resourceType': 'Composition',
        'id': 'Composition/' + (serial++).toString(),
        'section': []
    };

    var patients = [];

    proto.bundle.entry = [{
        'resource': proto.composition
    }];

    this.id = function (node) {
        proto.bundle['id'] = 'urn:hl7ii:' + node.attributes.root + ((node.attributes.extension) ? ':' + node.attributes.extension : '');
    };

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
    };

    this.code = function (node) {
        proto.composition['type'] = {
            'coding': [makeCode(node), {
                'system': node.attributes.codeSystemName,
                'code': node.attributes.code
            }]
        };
    };

    this.title$ = function (text) {
        proto.composition['title'] = text;
    };

    this.recordTarget = function (node) {

        var patient = {
            'resourceType': 'Patient',
            'id': 'Patient/' + ((this.patientId) ? this.patientId : (serial++).toString())
        };
        patients.push(patient);

        if (proto.composition) {
            proto.composition.subject = {
                'reference': patient.id
            };
        }

        proto.bundle.entry.push({
            resource: patient
        });

        proto.control.push(new Triplet(node, new RecordTarget(patient)));
    };

    /* TODO try to capture non-clinical information like
    author,
    dataEneterer,
    informant,
    custodian,
    informationRecipient,
    legalAuthenticator,
    authenticator & documentationOf  */

    this.component = function (node) {
        // http://cdatools.org/infocenter/index.jsp?topic=%2Forg.openhealthtools.mdht.uml.cda.consol.doc%2Fclasses%2FContinuityOfCareDocument.html
        var validCCDATemplateIds = ['2.16.840.1.113883.10.20.22.1.4' /* Consultation Note */ ,
            '2.16.840.1.113883.10.20.22.1.2' /* Continuity Of Care Document (V2)*/ ,
            '2.16.840.1.113883.10.20.22.1.5' /* Diagnostic Imaging Report */ ,
            '2.16.840.1.113883.10.20.22.1.8' /* Discharge Summary */ ,
            '2.16.840.1.113883.10.20.22.1.3' /* History And Physical Note */ ,
            '2.16.840.1.113883.10.20.22.1.7' /* Operative Note */ ,
            '2.16.840.1.113883.10.20.22.1.6' /* Procedure Note */ ,
            '2.16.840.1.113883.10.20.22.1.9' /* Progress Note */ ,
            '2.16.840.1.113883.10.20.21.1.10' /* Unstructured Document */
        ];
        if (_.any(templateId, function (value) {
                return _.contains(validCCDATemplateIds, value);
            })) {
            proto.control.push(new Triplet(node, new Component(null)));
        } else {
            parserStream.error = new Error('Not CCDA document');
        }
    };

    this.get = function () {
        return proto.bundle;
    };
};
ClinicalDocument.prototype = proto;

var Start = function (patientId, parserStream) {
    var clinicalDocument = new ClinicalDocument(patientId, parserStream);

    this.ClinicalDocument = function (node) {
        proto.control.push(new Triplet(node, clinicalDocument));
    };

    this.get = function () {
        return fixup(clinicalDocument.get());
    };
};
Start.prototype = proto;

var fixup = function (bundle) {
    _.forEach(bundle.entry, function (entry) {
        switch (entry.resource.resourceType) {
        case 'Condition':
            if (entry.resource.hasOwnProperty('onsetPeriod')) {
                if (entry.resource.onsetPeriod.start === entry.resource.onsetPeriod.end) {
                    //collapse to a single value
                    entry.resource.onsetDateTime = entry.resource.onsetPeriod.start;
                    delete entry.resource.onsetPeriod;
                }
            }
            break;
        }
    });
    return bundle;
};

var text;

var Transform = require("stream").Transform;
var util = require("util");

function CdaHandler(patientId) {
    var self = this;

    /* Clean module variables */
    this.last = new Start(patientId, this);
    proto.control = [new Triplet({}, this.last)];
    text = null;
    this.error = null;
    serial = 1;
    /* */

    this.peek = function () {
        var doc = _.last(proto.control);
        if (doc) {
            return doc.entity.obj();
        }
        return null;
    };

    this.pop = function (tagname) {
        if (_.last(proto.control).node.name === tagname) {
            proto.control.pop();
        }
    };

    this.pushDummy = function (node) {
        proto.control.push(new Triplet(node, dummy));
    };

    this.result = function (node) {
        if (self.error) {
            return self.error;
        } else {
            return self.last.get();
        }
    };

}

function CcdaParserStream(patientId) {
    Transform.call(this, {
        "objectMode": true
    }); // invoke Transform's constructor, expected result is object

    var self = this;

    /* Clean module variables */
    this.last = new Start(patientId, this);
    proto.control = [new Triplet({}, this.last)];
    text = null;
    this.error = null;
    serial = 1;
    /* */

    // "Data cruncher" --------------------------
    // stream usage
    // takes the same options as the parser
    this.saxStream = require("sax").createStream(true, {
        'trim': true
    });

    this.saxStream.on("error", function (e) {

        // unhandled errors will throw, since this is a proper node
        // event emitter.
        if (!self.error) {
            self.error = e;
        }

        // Ignore all the rest

        // clear the error & trying to resume. all input data will be discarded
        //this._parser.error = null;
        //this._parser.resume();
    });

    this.saxStream.on("opentag", function (node) {

        if (self.error) {
            return;
        }

        //console.log("opentag", node.name, this._parser.line);
        //Skip node if it contains nullFlavor attribute
        if (true /*!node.attributes.nullFlavor*/ ) {
            //Peek item from top of stack
            var doc = _.last(proto.control);
            //Trying to get processing handler
            if (doc) {
                var entity = doc.entity.obj();
                var handler = entity[node.name];
                if (handler) {
                    handler.call(entity, node); //Process node
                } else {
                    if (!node.isSelfClosing && !entity[node.name + '$']) {
                        //console.log("pushing dummy ", node.name);
                        proto.control.push(new Triplet(node, dummy));
                    }
                }
            } else {
                console.log('++++', node); // Error?
            }
        } else {
            proto.control.push(new Triplet(node, dummy));
        }

    });

    this.saxStream.on("closetag", function (tagname) {

        if (self.error) {
            return;
        }

        //console.log("closetag", tagname);
        //Peek item from top of stack
        var doc = _.last(proto.control);
        if (doc) {
            //Trying to get processing handler
            var handler = doc.entity.obj()[tagname + '$'];
            if (handler) {
                handler(text); //Process node
            }
        } else {
            console.log('----', tagname); // Error?
        }
        //Check the 'control stack' and remove top itemm if we done
        if (_.last(proto.control).node.name === tagname) {
            proto.control.pop();
        }

    });

    /* No need in this
    this.saxStream.on("attribute", function (node) {
      console.log("attribute", node);
    });*/

    //Collect tag's text if any
    this.saxStream.on("text", function (node) {
        //console.log("text", node);
        text = node;
    });

    //We are done, print result
    this.saxStream.on("end", function () {
        //console.timeEnd('sax'); //Done, check the time
        //console.log(proto.control.length);
        //console.log(JSON.stringify(makeTransactionalBundle(last.get(), 'http://localhost:8080/fhir/base'), null, ' '));
    });

    //No work yet done before this point, just definitions
    //console.time('sax');    
}

util.inherits(CcdaParserStream, Transform); // inherit Transform

/**
 * @Function _transform
 * Define standart Transform Stream's function _transform
 * @param (String) line - input line
 * @param (String) encoding - encoding (not used now)
 * @param cb - callback to notify that we are done with a row
 */
CcdaParserStream.prototype._transform = function (line, encoding, cb) {
    this.saxStream.write(line);
    cb();
};

/**
 * @Function _flush
 * Define standart Transform Stream's function _flush
 * Normally in should push parsed result (or error) to a pipe
 * @param cb - callback to notify that we are done
 */
CcdaParserStream.prototype._flush = function (cb) {

    if (this.error) {
        this.push(this.error);
    } else {
        //this.push( makeTransactionalBundle( last.get(), "http://localhost:8080/fhir") );
        this.push(this.last.get());
    }
    cb();
};

//Just create a copy of input file while producing data organized in a bundle
//fs.createReadStream(__dirname + '/test/artifacts/bluebutton-01-original.xml')
//    .pipe(new CcdaParserStream())
//    .pipe(fs.createWriteStream("file-copy.xml"));

module.exports = {
    CcdaParserStream: CcdaParserStream,
    CdaHandler: CdaHandler
};
