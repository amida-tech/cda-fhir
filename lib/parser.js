/* jshint -W003 */
/* jshint -W040 */
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/mocha/mocha.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts" />

"use strict";

//TODO process substanceAdministration/performer
// Startup file for debugging
var fs = require('fs');
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
 * @param {Object} node
 * @param {Object} entity
 * @param {Array} [templateId]
 * @return {void}
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
        case 19: //20090227130000+0500
            return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2)
            + 'T' + date.substr(8, 2) + ':' + date.substr(10, 2)+ ':' + date.substr(12, 2)
            + 'Z' + date.substr(14, 3);
        }
    }
    return date;
};

var isInContextOf = function (oids) {
    var inContext;
    if (_.isArray(oids)) {
        inContext = _.findLast(proto.control, function (triplet) {
            return _.any(triplet, oids);
        });
    } else {
        inContext = _.findLast(proto.control, function (triplet) {
            return _.contains(triplet.templateId, oids);
        });
    }
    return inContext || false;
};

var store2bundle = function(resource, patientId) {
  proto.bundle.entry.push(
      {'resource':resource}
      );
          proto.composition.section.push({
            'subject': {
                'reference': patientId
            },
            'content': {
                'reference': resource.id
            }
        });
};


var makeCode = function (node) {
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
            system = 'http://www.ama-assn.org/go/cpt ';
            break;
        default:
            system = 'urn:oid:' + node.attributes.codeSystem;
            break;
        }
    }
    var retval = {
        'system': system,
        'code': node.attributes.code,
        'display': node.attributes.displayName
    };
    return retval;
};

var recodeAddrUse = function(use) {
   switch(use) {
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

var recodeTelecomUse = function(use) {
   switch(use) {
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

var recodeTelecom = function(node) {
    var telecom = {
                'use': recodeTelecomUse(node.attributes.use)
    };
    var attr = node.attributes.value.split(':');
    if(attr.length === 2) {
        switch(attr[0]) {
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
         telecom.value= node.attributes.value;

    }
    return telecom;
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
        value.transaction = {
            'method': 'POST',
            'url': value.resource.resourceType
        };
        value.base = base;
    });
    return bundle;
};

var makeAndStoreObservation = function ( patient )  {
  var observation = getResource('Observaton', {
            'id': 'Observation/' + (serial++).toString(),
            'subject': {
                'reference': patient.id
            }
        });
        proto.bundle.entry.push({
            'resource': observation
        });
        proto.composition.section.push({
            'subject': {
                'reference': patient.id
            },
            'content': {
                'reference': observation.id
            }
        });
        return observation;
};

//Make it common root
var proto = {
    tags: [], // Stack of XML tags processed
    bundle: {},
    composition: {},

    findPatient: function () {
        var patient;
        _.each(proto.bundle.entry, function (value) {
            if (value.resource.resourceType === 'Patient') {
                patient = value.resource;
                return false;
            }
            return true;
        });
        return patient;
    },
    obj: function () {
        return this;
    },

    id: function (node) {
        if (node.attributes.nullFlavor === 'NI') {
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
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }
        ensureProperty.call(organization, 'telecom', true).push(recodeTelecom(node));
    };

    this.addr = function (node) {
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }
        var address = {
            'use': recodeAddrUse(node.attributes.use)
        };
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
                ensureProperty.call(coverage, 'identifier', true).push(node.attributes.root);
            },
            representedOrganization: function (node) {
                var organization = {
                    'resourceType': 'Organization',
                    'id': 'Organization/' + (serial++).toString()
                };
                coverage.issuer = {
                    'reference': organization.id
                };
                proto.bundle.entry.push({
                    'resource': organization
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': organization.id
                    }
                });
                proto.control.push(new Triplet(node, new Organization(organization)));
            }
        };
    } else if (templateId && _.contains(templateId, '2.16.840.1.113883.10.20.22.4.88')) {
        //Guarantor Information... The person responsible for the final bill.
        var contact = resource;
        this._self = {
            id: function (node) {
                ensureProperty.call(contact, 'identifier', true).push(node.attributes.root);
            },
            code: function (node) {
                contact.relationship = {
                    'coding': [makeCode(node)]
                };
            },
            addr: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }
                var address = {
                    'use': recodeAddrUse(node.attributes.use)
                };
                ensureProperty.call(contact, 'address', true).push(address);

                proto.control.push(new Triplet(node, new Addr(address)));
            },

            telecom: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }
                ensureProperty.call(contact, 'telecom', true).push(recodeTelecom(node));
            },

            assignedPerson: function (node) {
                proto.control.push(new Triplet(node, new AssignedPerson(ensureProperty.call(contact, 'name'))));
            }
        };
    } else {
        var practitioner = resource;

        this._self = {
            addr: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }
                var address = {
                    'use': recodeAddrUse(node.attributes.use)
                };
                ensureProperty.call(practitioner, 'address', true).push(address);

                proto.control.push(new Triplet(node, new Addr(address)));
            },

            telecom: function (node) {
                if (node.attributes.nullFlavor === 'UNK') {
                    return;
                }
                ensureProperty.call(practitioner, 'telecom', true).push(recodeTelecom(node));
            },

            representedOrganization: function (node) {
                var organization = {
                    'resourceType': 'Organization',
                    'id': 'Organization/' + (serial++).toString()
                };
                practitioner.managingOrganization = {
                    'reference': organization.id
                };
                proto.bundle.entry.push({
                    'resource': organization
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': organization.id
                    }
                });
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
                        var coverage = {
                            'resourceType': 'Coverage',
                            'id': 'Coverage/' + (serial++).toString()
                        };
                        coverage.subscriber = {
                            'referencre': patient.id
                        };
                        proto.bundle.entry.push({
                            'resource': coverage
                        });
                        proto.composition.section.push({
                            'subject': {
                                'reference': patient.id
                            },
                            'content': {
                                'reference': coverage.id
                            }
                        });
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
                ensureProperty.call(procedure, 'performer', true).push({
                    'reference': practitioner.id
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
                resource.name = node.attributes.displayName;
                resource.code = {
                    'coding': [makeCode(node)]
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
                resource.vaccineType = {
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

                var organization = {
                    'resourceType': 'Organization',
                    'id': 'Organization/' + (serial++).toString()
                };
                resource.manufacturer = {
                    'reference': organization.id
                };
                proto.bundle.entry.push({
                    'resource': organization
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': organization.id
                    }
                });
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

                var organization = {
                    'resourceType': 'Organization',
                    'id': 'Organization/' + (serial++).toString()
                };
                resource.manufacturer = {
                    'reference': organization.id
                };
                proto.bundle.entry.push({
                    'resource': organization
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': organization.id
                    }
                });
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

var Consumable = function (resource) {
    var patient = findPatient(proto.bundle);

    this.manufacturedProduct = function (node) {

        switch (resource.resourceType) {
        case 'MedicationAdministration':
            var medicationAdministration = resource;
            var medication = {
                'resourceType': 'Medication',
                'id': 'Medication/' + (serial++).toString()
            };
            proto.bundle.entry.push({
                'resource': medication
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': medication.id
                }
            });
            medicationAdministration.medication = {
                'reference': medication.id
            };
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
        object.end = dateFix(node.attributes.value);
    };

    this.period = function (node) {
        object.schedule.repeat.period = node.attributes.value;
        object.schedule.repeat.periodUnits = node.attributes.unit;
    };
    
};
EffectiveTime.prototype = proto;

var PlayingEntity = function (allergyIntolerance) {
    this.code = function (node) {
        ensureProperty.call(allergyIntolerance, 'substance', true).push({
            'coding': makeCode(node)
        });
    };
    this.name$ = function (text) {
        allergyIntolerance.name = text;
    };
};
PlayingEntity.prototype = proto;

var PlayingDevice = function (device) {
    this.code = function (node) {
        ensureProperty.call(device, 'type');
        device.type = {
            'coding': makeCode(node)
        };
    };
    this.id = function (node) {
        ensureProperty.call(device, 'identifier').push(node.attributes.root);
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
            if(isInContextOf('2.16.840.1.113883.10.20.22.4.49')) {
                procedure = resource;
            } else {
            procedure = findLastResourceOfType.call(proto.bundle.entry, 'Procedure');}
            if (procedure) {
                var patient = findPatient(proto.bundle);
                var location = getResource('Location', {
                    'id': 'Location/' + (serial++).toString()
                });
                proto.bundle.entry.push({
                    'resource': location
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': location.id
                    }
                });
                procedure.location = {
                    'reference': location.id
                };
                this._self = genericLocationHandler(location);
                this._self.prototype = proto;
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
            'units': node.attributes.unit
        };

    };

    this.high = function (node) {
        resource.high = {
            'value': node.attributes.value,
            'units': node.attributes.unit
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

var genericObservationHandler = function (observation, templateId) {
    return {
        id: function (node) {
            ensureProperty.call(observation, 'identifier', true).push(node.attributes.root);
        },
        code: function (node) {
            observation.code = {
                'coding': makeCode(node)
            };
        },
        statusCode: function (node) {
            observation.status = node.attributes.code;
        },
        effectiveTime: function (node) {
            if (node.attributes.value) {
                observation.appliesDateTime = dateFix(node.attributes.value);
            } else {
                observation.appliesPeriod = {};
                proto.control.push(new Triplet(node, new EffectiveTime(null, observation.appliesPeriod), templateId));
            }
        },
        value: function (node) {
            switch (node.attributes['xsi:type']) {
            case 'PQ':
                observation.valueQuantity = {
                    'value': node.attributes.value,
                    'units': node.attributes.unit
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
            proto.control.push(new Triplet(node, new ReferenceRange(ensureProperty.call(observation, 'referenceRange')), templateId));
        },
        targetSiteCode: function (node) {
            observation.bodySiteCodeableConcept = {
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
    var clinicalImpression;
    var condition;
    var last;

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
                    _event.manifestation = [{
                        'coding': [
                            makeCode(node)
                        ]
                    }];
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
                    //_allergyIntolerance.status = node.attributes.displayName;
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.9': //Reaction observation
            var event = param1;

            _allergyIntolerance = resource;
            this._self = {
                value: function (node) {
                    event.manifestation = [{
                        'coding': [makeCode(node)]
                    }];
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
                    event.severity = node.attributes.displayName; //TODO conversion from 'code' to meaningful
                }
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.19': //MEDICATIONS / Indication
            var _condition = resource;
            this._self = {
                code: function (node) {
                    _condition.category = {
                        'coding': [makeCode(node)]
                    };

                },

                statusCode: function (node) {
                    //TODO recode to FHIR
                    _condition.clinicalStatus = node.attributes.code;
                },

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
            break;

        case '2.16.840.1.113883.10.20.22.4.53': // Immunization refusal
            var immunization = resource;
            this._self = {
                code: function (node) {
                    ensureProperty.call(immunization, 'explanation');
                    ensureProperty.call(immunization.explanation, 'resonNotGiven', true).push({
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
                    last = _.last(ensureProperty.call(familyMemberHistory, 'condition', true));
                    if (last) {
                        last.outcome = node.attributes.displayName;
                    }
                }
            };
            this._self.prototype = proto;

            break;
        case '2.16.840.1.113883.10.20.22.4.31': // Age observation (familyhistory)
                        if(isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                    condition = findLastResourceOfType.call(proto.bundle.entry,'Condition');
                    if(condition) {
                        this._self = {
                              code: function(node) {
                              condition.onsetAge = _.merge( makeCode(node),condition.onsetAge); 
                          },
                          value: function(node) {
                              ensureProperty.call(condition,'onsetAge').value = node.attributes.value;
                          }
                        };
                        this._self.prototype = proto;
                    }
                } else if (isInContextOf('2.16.840.1.113883.10.20.22.4.46')) { // Family history observation

            familyMemberHistory = resource;
            this._self = {
                value: function (node) {
                    last = _.last(ensureProperty.call(familyMemberHistory, 'condition', true));
                    if (last) {
                        last.onsetAge = node.attributes.value;
                    }
                }
            };
            this._self.prototype = proto;
}
            break;
        case '2.16.840.1.113883.10.20.22.4.46': // Family history observation
            familyMemberHistory = resource;
            this._self = {
                value: function (node) {
                    if (param1) {
                        param1.type = {
                            'coding': [makeCode(node)]
                        };
                        if (!_.contains(ensureProperty.call(familyMemberHistory, 'condition', true), param1)) {
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
            this._self = genericObservationHandler(observation,templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.78': // Smoking status observation
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            this._self = genericObservationHandler(observation,templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.38': // Social history observation
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            this._self = genericObservationHandler(observation,templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.2': // Result observation
            observation = resource;
            this._self = genericObservationHandler(observation,templateId);
            this._self.prototype = proto;

            break;

        case '2.16.840.1.113883.10.20.22.4.13': // Procedure activity observation
            var procedure = findLastResourceOfType.call(proto.bundle.entry,'Procedure');
            observation = makeAndStoreObservation(findPatient(proto.bundle));
            if (procedure) {
                ensureProperty.call(procedure, 'relatedItem', true).push({
                    'reference': observation.id
                });
                this._self = genericObservationHandler(observation,templateId);
                this._self.prototype = proto;
            }

            break;

        case '2.16.840.1.113883.10.20.22.4.4': // Problem observation
  //console.log('>>>>',isInContextOf('2.16.840.1.113883.10.20.22.4.3'), resource);
       if(isInContextOf('2.16.840.1.113883.10.20.22.4.3')){ //Problem concern act
            condition = resource; 
            observation = getResource('Observaton', {
                'id': 'Observation/' + (serial++).toString(),
                'subject': {
                    'reference': condition.patient.reference
                }
            });
            proto.bundle.entry.push({
                'resource': observation
            });
            proto.composition.section.push({
                'subject': {
                    'reference': condition.patient.reference
                },
                'content': {
                    'reference': observation.id
                }
            });
            ensureProperty.call(condition, 'stage');
            ensureProperty.call(condition.stage, 'accessment', true).push({
                'reference': observation.id
            });
            this._self = genericObservationHandler(observation,templateId);
            this._self.prototype = proto;
}
            break;
            
            case '2.16.840.1.113883.10.20.22.4.6': //Problem status observation
                if(isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                    condition = findLastResourceOfType.call(proto.bundle.entry,'Condition');
                    if(condition) {
                        this._self = {
                          effectiveTime : function(node) {
                              if(node.attributes.value) {
                                  condition.abatementDate = dateFix(node.attributes.value);
                              } else {
                                  condition.abatementPeriod = {};
                                  proto.control.push(new Triplet(node, new EffectiveTime(node.attributes['xsi:type'],condition.abatementPeriod), templateId));
                              }
                          }
                        };
                        this._self.prototype = proto;
                    }
                }
            break;
            
           case '2.16.840.1.113883.10.20.22.4.5': // Health status observation template
                if(isInContextOf('2.16.840.1.113883.10.20.22.4.4')) { //Problem observation
                    condition = findLastResourceOfType.call(proto.bundle.entry,'Condition');
                    if(condition) {
                        this._self = {
                          //TODO what?
                        };
                        this._self.prototype = proto;
                    }
                }
            break;
            
                        case '2.16.840.1.113883.10.20.22.4.44': //Plan of care activity observation
                var carePlan = resource;
                var procedureRequest = getResource('ProcedureRequest', { 'id': 'ProcedureRequest/' + (serial++).toString(), 'subject' : {'reference' : carePlan.patient.reference}});
                store2bundle(procedureRequest,carePlan.patient.reference);
                ensureProperty.call(carePlan, 'activity',true).push({'refrence':procedureRequest.id});
                this._self = {
                    code: function (node) {
                            procedureRequest.code = {
                                'coding': [makeCode(node)]
                            };
                        },
                        statusCode: function (node) {
                            procedureRequest.clinicalStatus = node.attributes.code;
                        },
                        effectiveTime: function (node) {
                            procedureRequest.timingDateTime = {};
                            proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'timingDateTime'), templateId));
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

var Product = function (medicationPrescription) {
    var patient = findPatient(proto.bundle);

    this.manufacturedProduct = function (node) {

        var medication = {
            'resourceType': 'Medication',
            'id': 'Medication/' + (serial++).toString()
        };
        proto.bundle.entry.push({
            'resource': medication
        });
        proto.composition.section.push({
            'subject': {
                'reference': patient.id
            },
            'content': {
                'reference': medication.id
            }
        });
        medicationPrescription.medication = {
            'reference': medication.id
        };
        proto.control.push(new Triplet(node, new ManufacturedProduct(medication)));
    };
};
Product.prototype = proto;

var Author = function (medicationPrescription) {
    var patient = findPatient(proto.bundle);

    this.assignedAuthor = function (node) {
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
        medicationPrescription.practitioner = {
            'reference': practitioner.id
        };
        proto.control.push(new Triplet(node, new AssignedEntity(practitioner)));
    };

};
Author.prototype = proto;

var Supply = function (resource) {
    var templateId = [];

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.17':

            var medicationPrescription;
            if (!resource.prescription) {
                var _patient = findPatient(proto.bundle);
                medicationPrescription = {
                    'resourceType': 'MedicationPrescription',
                    'id': 'MedicationPrescription/' + (serial++).toString()
                };
                proto.bundle.entry.push({
                    'resource': medicationPrescription
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': _patient.id
                    },
                    'content': {
                        'reference': medicationPrescription.id
                    }
                });
                resource.medicationPrescription = {
                    'reference': medicationPrescription.id
                };
            }
            if (!medicationPrescription) {
                medicationPrescription = findResource.call(proto.bundle.entry, resource.prescription.reference);
            }

            this._self = {

                statusCode: function (node) {
                    // TODO Recode?
                    medicationPrescription.status = node.attributes.code;
                },

                effectiveTime: function (node) {
                    var subType = node.attributes['xsi:type'];
                    switch (subType) {
                    case 'IVL_TS':
                        //console.log('???', _medicationPrescription);
                        ensureProperty.call(ensureProperty.call(medicationPrescription, 'dispense'), 'validityPeriod');
                        proto.control.push(new Triplet(node, new EffectiveTime(subType, medicationPrescription.dispense.validityPeriod)));
                        break;
                    default:
                        proto.control.push(new Triplet(node, dummy));
                        break;
                    }
                },

                repeatNumber: function (node) {
                    ensureProperty.call(medicationPrescription, 'dispense').numberOfRepeatsAllowed = node.attributes.value;
                },

                quantity: function (node) {
                    ensureProperty.call(medicationPrescription, 'dispense').quantity = {
                        'value': node.attributes.value
                    };
                },

                product: function (node) {
                    proto.control.push(new Triplet(node, new Product(medicationPrescription)));
                },

                /* TODO Find out semantic of this
                this.performer = function(node) {
                };*/

                author: function (node) {
                    proto.control.push(new Triplet(node, new Author(medicationPrescription)));
                },

                /* TODO Wrapper for additional instructions
                this.entryRelationship = function(node) {
                };*/
            };
            this._self.prototype = proto;
            break;

        case '2.16.840.1.113883.10.20.22.4.50': //Non-medicinal supply activity
            var patient = findPatient(proto.bundle);
            var device = {
                'device': 'Device',
                'id': 'Device/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            };
            proto.bundle.entry.push({
                'resource': device
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': device.id
                }
            });

            this._self = {
                statusCode: function (node) {
                    device.status = node.attributes.statusCode; //TODO recode
                },
                /*effectiveTime: function (node) {
                },*/
                /*quantity: function (node) {
                },*/
                participant: function (node) {
                    proto.control.push(new Triplet(node, new Participant(device)));
                },
            };
            this._self.prototype = proto;
            break;
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };

};
Supply.prototype = proto;

var genericProcedureHandlder = function (procedure) {
    return {
        id: function (node) {
            ensureProperty.call(procedure, 'identifier', true).push(node.attributes.root);
        },
        code: function (node) {
            procedure.type = {
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
                'siteCodeableConcept': {
                    'coding': [makeCode(node)]
                }
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
            var device = {
                'device': 'Device',
                'id': 'Device/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            };
            proto.bundle.entry.push({
                'resource': device
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': device.id
                }
            });
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
            break;
            
        case '2.16.840.1.113883.10.20.22.4.41': //Plan of care activity procedure
                var carePlan = resource;
                var procedureRequest = getResource('ProcedureRequest', { 'id': 'ProcedureRequest/' + (serial++).toString(), 'subject' : {'reference' : carePlan.patient.reference}});
                store2bundle(procedureRequest,carePlan.patient.reference);
                ensureProperty.call(carePlan, 'activity',true).push({'refrence':procedureRequest.id});
                this._self = {
                    code: function (node) {
                            procedureRequest.code = {
                                'coding': [makeCode(node)]
                            };
                        },
                        statusCode: function (node) {
                            procedureRequest.clinicalStatus = node.attributes.code;
                        },
                        effectiveTime: function (node) {
                            procedureRequest.timingDateTime = {};
                            proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'timingDateTime'), templateId));
                        }
                };
                this._self.prototype = proto;
            break;

        default:
            this._self = genericProcedureHandlder(resource);
            break;
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
Procedure.prototype = proto;

var EntryRelationshipMedication = function (typeCode, medicationAdministration) {
    var _medicationAdministration = medicationAdministration;

    this.observation = function (node) {
        var _patient = findPatient(proto.bundle);
        var condition = {
            'resourceType': 'Condition',
            'id': 'Condition/' + (serial++).toString(),
            'patient': {
                'reference': _patient.id
            }
        };
        var medicationPrescription = findResource.call(proto.bundle.entry, _medicationAdministration.prescription.reference);
        if (medicationPrescription) {
            medicationPrescription.reasonReference = {
                'reference': condition.id
            };
        }
        proto.bundle.entry.push({
            'resource': condition
        });
        proto.composition.section.push({
            'subject': {
                'reference': _patient.id
            },
            'content': {
                'reference': condition.id
            }
        });

        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, condition, null)));
    };

    this.supply = function (node) {

        proto.control.push(new Triplet(node, new Supply(medicationAdministration)));
    };

};
EntryRelationshipMedication.prototype = proto;

var EntryRelationshipAllergyIntolerance = function (typeCode, allergyIntolerance) {

    this.observation = function (node) {
        var event = ensureProperty.call(allergyIntolerance, 'event', true);
        if (event.length === 0) {
            event.push({});
        }
        proto.control.push(new Triplet(node, new Observation(node.attributes.classCode, allergyIntolerance, allergyIntolerance.event[0])));
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
    var _patient = findPatient(proto.bundle);
    var templateId = [];
    var substanceAdministration;

    function getDosage() {
        var dosage = _.last(this.dosage);
        if (!dosage) {
            dosage = {
                /*'schedule': {
                    'repeat': {}
                }*/
            };
            this.dosage.push(dosage);
        }
        return dosage;
    }

    this.templateId = function (node) {
        templateId.push(node.attributes.root);

        switch (node.attributes.root) {
        case '2.16.840.1.113883.10.20.22.4.52': //Immunization activity

            var immunization = {
                'resourceType': 'Immunization',
                'id': 'Immunization/' + (serial++).toString(),
                'patient': {
                    'reference': _patient.id
                }
            };

            proto.bundle.entry.push({
                'resource': immunization
            });
            proto.composition.section.push({
                'subject': {
                    'reference': _patient.id
                },
                'content': {
                    'reference': immunization.id
                }
            });

            substanceAdministration = _.findLast(proto.control, function (value) {
                return value.node.name === 'substanceAdministration';
            });
            if (substanceAdministration && substanceAdministration.node.attributes.negationInd) {
                immunization.wasNotGiven = true;
            }

            this._self = {
                statusCode: function (node) {
                    immunization.status = node.attributes.code;
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
                        'coding': [
                            makeCode(node)
                        ]
                    };
                },
                doseQuantity: function (node) {
                    immunization.doseQuantity = {
                        'value': node.attributes.value,
                        'units': node.attributes.unit
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

            var _medicationPrescription = {
                'resourceType': 'MedicationPrescription',
                'id': 'MedicationPrescription/' + (serial++).toString(),
                'patient': {
                    'reference': _patient.id
                },
                'dosageInstruction': []
            };
            var _medicationAdministration = {
                'resourceType': 'MedicationAdministration',
                'id': 'MedicationAdministration/' + (serial++).toString(),
                'patient': {
                    'reference': _patient.id
                },
                'prescription': {
                    'reference': _medicationPrescription.id
                },
                'dosage': []
            };

            proto.bundle.entry.push({
                'resource': _medicationPrescription
            });
            proto.composition.section.push({
                'subject': {
                    'reference': _patient.id
                },
                'content': {
                    'reference': _medicationPrescription.id
                }
            });

            proto.bundle.entry.push({
                'resource': _medicationAdministration
            });
            proto.composition.section.push({
                'subject': {
                    'reference': _patient.id
                },
                'content': {
                    'reference': _medicationAdministration.id
                }
            });

            substanceAdministration = _.findLast(proto.control, function (value) {
                return value.node.name === 'substanceAdministration';
            });
            if (substanceAdministration && substanceAdministration.node.attributes.negationInd) {
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
                        var scheduledTiming = {
                            'schedule': {
                                'repeat': {}
                            }
                        };
                        _medicationPrescription.dosageInstruction.push(scheduledTiming);
                        proto.control.push(new Triplet(node, new EffectiveTime(subType, scheduledTiming), templateId));
                        break;
                    default:
                        proto.control.push(new Triplet(node, dummy, templateId));
                        break;
                    }
                },

                routeCode: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.route = {
                        'coding': makeCode(node)
                    };
                },

                doseQuantity: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.quantity = {
                        'value': node.attributes.value,
                        'units': node.attributes.unit
                    };
                },

                rateQuantity: function (node) {
                    var dosage = getDosage.call(_medicationAdministration);
                    dosage.rate = {
                        'numerator': {
                            'value': node.attributes.value,
                            'units': node.attributes.unit
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
                    proto.control.push(new Triplet(node, new Consumable(_medicationAdministration), templateId));
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
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, procedure), templateId));
                }
            };
            this._self.prototype = proto;
            break;
        case '2.16.840.1.113883.10.20.22.4.3': //Problem concern act
            var clinicalImpression = resource;
            var condition = getResource('Condition', {
                'id': 'Condition/' + (serial++).toString(),
                'patient': {
                    'reference': clinicalImpression.patient.reference
                }
            });
             store2bundle(condition,clinicalImpression.patient.reference);
            this._self = {
                entryRelationship: function (node) {
                    ensureProperty.call(clinicalImpression, 'problem', true).push({'reference' : condition.id});
                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, condition), templateId));

                },
                 id: function (node) {
                     ensureProperty.call(condition, 'identifier', true).push(node.attributes.root);
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
                var procedureRequest = getResource('ProcedureRequest', { 'id': 'ProcedureRequest/' + (serial++).toString(), 'subject' : {'reference' : carePlan.patient.reference}});
                store2bundle(procedureRequest,carePlan.patient.reference);
                ensureProperty.call(carePlan, 'activity',true).push({'refrence':procedureRequest.id});
                this._self = {
                    code: function (node) {
                            procedureRequest.code = {
                                'coding': [makeCode(node)]
                            };
                        },
                        statusCode: function (node) {
                            procedureRequest.clinicalStatus = node.attributes.code;
                        },
                        effectiveTime: function (node) {
                            procedureRequest.timingDateTime = {};
                            proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'timingDateTime'), templateId));
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
        familyMemberHistory.relationship = {
            'coding': [makeCode(node)]
        };
    };

    this.subject = function (node) {
        proto.control.push(new Triplet(node, new Subject(familyMemberHistory)));
    };

    this['sdtc:id'] = function (node) {
        if (node.attributes.root === '2.16.840.1.113883.19.5.99999.2') {
            this._self = {
                administrativeGenderCode: function (node) {
                    switch (node.attributes.code) {
                    case 'M':
                        familyMemberHistory.gender = 'male';
                        break;
                    case 'F':
                        familyMemberHistory.gender = 'female';
                        break;
                    }
                },
                birthTime: function (node) {
                    familyMemberHistory.bornDate = dateFix(node.attributes.value);
                }
            };
        }
    };

    this.obj = function () {
        return (this._self) ? this._self : this;
    };
};
RelatedSubject.prototype = proto;

var Encounter = function (resource) {
    var templateId = [];
    
    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch(node.attributes.root) {
            case '2.16.840.1.113883.10.20.22.4.40': //Plan of care activity encounter
                var carePlan = resource;
                var procedureRequest = getResource('ProcedureRequest', { 'id': 'ProcedureRequest/' + (serial++).toString(), 'subject' : {'reference' : carePlan.patient.reference}});
                store2bundle(procedureRequest,carePlan.patient.reference);
                ensureProperty.call(carePlan, 'activity',true).push({'refrence':procedureRequest.id});
                this._self = {
                    code: function (node) {
                            procedureRequest.code = {
                                'coding': [makeCode(node)]
                            };
                        },
                        statusCode: function (node) {
                            procedureRequest.clinicalStatus = node.attributes.code;
                        },
                        effectiveTime: function (node) {
                            procedureRequest.timingDateTime = {};
                            proto.control.push(new Triplet(node, new EffectiveTimeSingleValue(procedureRequest, 'timingDateTime'), templateId));
                        }
                };
                this._self.prototype = proto;
            break;
            case '2.16.840.1.113883.10.20.22.4.49': //Plan of care activity encounter
                var patient = findPatient(proto.bundle);
                var encounter = getResource('Encounter', { 'id': 'Encounter/' + (serial++).toString(), 'patient' : {'reference' : patient.id}});
                store2bundle(encounter, patient.id);
                //ensureProperty.call(carePlencounteran, 'activity',true).push({'refrence':procedureRequest.id});
                this._self = {
                                id: function (node) {
                ensureProperty.call(encounter, 'identifier', true).push(node.attributes.root);
            },
                    code: function (node) {
                            encounter.type = {
                                'coding': [makeCode(node)]
                            };
                        },
                        effectiveTime: function (node) {
                            if(node.attributes.value) {
                                encounter.period =_.merge({},encounter.period);
                                encounter.period.low = dateFix(node.attributes.value);
                            }
                        },
                        participant : function (node) {
                            proto.control.push(new Triplet(node, new Participant(encounter), templateId));
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
            var familyMemberHistory = getResource('FamilyMemberHistory', {
                'id': 'FamilyMemberHistory/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            });

            proto.bundle.entry.push({
                'resource': familyMemberHistory
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': familyMemberHistory.id
                }
            });
            proto.control.push(new Triplet(node, new Subject(familyMemberHistory), templateId));
            resource = familyMemberHistory;
        }
    };

    this.component = function (node) {
        var observation;
        var familyHistoryOrganizer = '2.16.840.1.113883.10.20.22.4.45';
        var vitalSignsOrganizer = '2.16.840.1.113883.10.20.22.4.26';
        var resultOrganizer = '2.16.840.1.113883.10.20.22.4.1';
        if (_.contains(templateId, familyHistoryOrganizer) || isInContextOf(familyHistoryOrganizer)) { //Family history organizer
            proto.control.push(new Triplet(node, new Component(resource), templateId));
        } else if (_.contains(templateId, resultOrganizer) || isInContextOf(resultOrganizer)) { //esult organizer
            observation = getResource('Observaton', {
                'id': 'Observation/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            proto.bundle.entry.push({
                'resource': observation
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': observation.id
                }
            });
            proto.control.push(new Triplet(node, new Component(observation), templateId));
        } else if (_.contains(templateId, vitalSignsOrganizer) || isInContextOf(vitalSignsOrganizer)) { //Vital signs organizer
            observation = getResource('Observaton', {
                'id': 'Observation/' + (serial++).toString(),
                'subject': {
                    'reference': patient.id
                }
            });
            proto.bundle.entry.push({
                'resource': observation
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': observation.id
                }
            });
            proto.control.push(new Triplet(node, new Component(observation), templateId));
        } else {
            var functionalStatusOrganizer = ['2.16.840.1.113883.10.20.22.4.2', '2.16.840.1.113883.10.20.22.4.67'];
            if (_.any(templateId, functionalStatusOrganizer) || isInContextOf(functionalStatusOrganizer)) { //Functional status section
                var clinicalImpression = getResource('ClinicalImpression', {
                    'id': 'ClinicalImpression/' + (serial++).toString(),
                    'patient': {
                        'reference': patient.id
                    }
                });
                proto.bundle.entry.push({
                    'resource': clinicalImpression
                });
                proto.composition.section.push({
                    'subject': {
                        'reference': patient.id
                    },
                    'content': {
                        'reference': clinicalImpression.id
                    }
                });
                resource = clinicalImpression;
                proto.control.push(new Triplet(node, new Component(resource), templateId));
            }
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

        var allergiesSection = ['2.16.840.1.113883.10.20.22.2.6', '2.16.840.1.113883.10.20.22.2.6.1'];
        if (isInContextOf(allergiesSection)) {

            patient = findPatient(proto.bundle);
            var allergyIntolerance = {
                'resourceType': 'AllergyIntolerance',
                'id': 'AllergyIntolerance/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            };

            proto.bundle.entry.push({
                'resource': allergyIntolerance
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': allergyIntolerance.id
                }
            });
            proto.control.push(new Triplet(node, new Act(allergyIntolerance), templateId));

        } else if (isInContextOf('2.16.840.1.113883.10.20.22.2.18')) {

            patient = findPatient(proto.bundle);
            var claim = {
                'resourceType': 'Claim',
                'id': 'Claim/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            };

            proto.bundle.entry.push({
                'resource': claim
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': claim.id
                }
            });
            proto.control.push(new Triplet(node, new Act(claim), templateId));
        } else if (isInContextOf('2.16.840.1.113883.10.20.22.2.5') || isInContextOf('2.16.840.1.113883.10.20.22.2.5')) {
            //conforms to Problems section with entries optional
            //Problems section with entries required

            patient = findPatient(proto.bundle);
            var clinicalImpression = {
                'resourceType': 'ClinicalImpression',
                'id': 'ClinicalImpression/' + (serial++).toString(),
                'patient': {
                    'reference': patient.id
                }
            };

            proto.bundle.entry.push({
                'resource': clinicalImpression
            });
            proto.composition.section.push({
                'subject': {
                    'reference': patient.id
                },
                'content': {
                    'reference': clinicalImpression.id
                }
            });
            proto.control.push(new Triplet(node, new Act(clinicalImpression), templateId));
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
        if(isInContextOf('2.16.840.1.113883.10.20.22.2.7.1')) { //Procedures section with entries required
        var patient = findPatient(proto.bundle);
        var procedure = getResource('Procedure', {
            'id': 'Procedure/' + (serial++).toString(),
            'patient': {
                'reference': patient.id
            }
        });
        proto.bundle.entry.push({
            'resource': procedure
        });
        proto.composition.section.push({
            'subject': {
                'reference': patient.id
            },
            'content': {
                'reference': procedure.id
            }
        });
        proto.control.push(new Triplet(node, new Procedure(procedure), templateId));}
        else {
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

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
        switch(node.attributes.root) {
            case '2.16.840.1.113883.10.20.22.2.10': //Plan of care section
            var patient = findPatient(proto.bundle);
            resource = getResource('CarePlan', {'id': 'CarePlan' + (serial++).toString(),'patient':{'reference': patient.id}})
            store2bundle(resource,resource.reference);
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
        var name = {
            'use': node.attributes.use
        };
        _some.name.push(name);

        proto.control.push(new Triplet(node, new Name(name)));
    };
};
SomeWithName.prototype = proto;

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
            'coding': {
                'code': node.attributes.code
            }
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
        _patient.gender = node.attributes.code;
    };

    this.birthTime = function (node) {
        _patient.birthDate = dateFix(node.attributes.value);
    };
    this.maritalStatusCode = function (node) {
        _patient.maritalStatus = {
            coding: makeCode(node)
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
            'url': 'http://hl7.org/fhir/Profile/us-core#race',
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
            'url': 'http://hl7.org/fhir/Profile/us-core#ethnicity',
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
    SomeWithName.call(this, patient);
};
AssignedPerson.prototype = new SomeWithName(null);

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
        if (!_patient.identifier) {
            _patient.identifier = [];
        }
        _patient.identifier.push({
            'system': 'urn:oid:' + node.attributes.root,
            'value': node.attributes.extension
        });
    };

    this.addr = function (node) {
        var address = {
            'use': recodeAddrUse(node.attributes.use)
        };
        if (!_patient.address) {
            _patient.address = [address];
        }
        proto.control.push(new Triplet(node, new Addr(address)));
    };

    this.telecom = function (node) {
        if (!_patient.telecom) {
            _patient.telecom = [];
        }
        _patient.telecom.push(recodeTelecom(node));
    };

    this.patient = function (node) {
        proto.control.push(new Triplet(node, new Patient(_patient)));
    };

    this.providerOrganization = function (node) {
        var organization = {
            'resourceType': 'Organization',
            'id': 'Organization/' + (serial++).toString()
        };
        _patient.managingOrganization = {
            'reference': organization.id
        };
        proto.bundle.entry.push({
            'resource': organization
        });
        proto.composition.section.push({
            'subject': {
                'reference': _patient.id
            },
            'content': {
                'reference': organization.id
            }
        });
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

var ClinicalDocument = function () {
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
        proto.bundle['id'] = 'urn:hl7ii:' + node.attributes.root + ':' + node.attributes.extension;
    };

    this.code = function (node) {
        proto.composition['type'] = {
            'coding': [makeCode(node), {
                'system': node.attributes.codeSystemName,
                'code': node.attributes.code
            }]
        };
    };

    this.title = function (node) {
        proto.composition['title'] = text;
    };

    this.recordTarget = function (node) {

        var patient = {
            'resourceType': 'Patient',
            'id': 'Patient/' + (serial++).toString()
        };
        patients.push(patient);

        proto.bundle.entry.push({
            resource: patient
        });

        proto.control.push(new Triplet(node, new RecordTarget(patient)));
    };

    /* TODO try tocapture non-clinical information like
    author,
    dataEneterer,
    informant,
    custodian,
    informationRecipient,
    legalAuthenticator,
    authenticator & documentationOf  */

    this.component = function (node) {
        proto.control.push(new Triplet(node, new Component(null)));
    };

    this.get = function () {
        return proto.bundle;
    };
};
ClinicalDocument.prototype = proto;

var Start = function () {
    var clinicalDocument = new ClinicalDocument();

    this.ClinicalDocument = function (node) {
        proto.control.push(new Triplet(node, clinicalDocument));
    };

    this.get = function () {
        return clinicalDocument.get();
    };
};
Start.prototype = proto;

var last = new Start();
proto.control = [new Triplet({}, last)];

var text;

// "Data cruncher" --------------------------
// stream usage
// takes the same options as the parser
var saxStream = require("sax").createStream(true, {
    'trim': true
});

saxStream.on("error", function (e) {
    // unhandled errors will throw, since this is a proper node
    // event emitter.
    console.error("error!", e);
    // clear the error
    this._parser.error = null;
    this._parser.resume();
});

saxStream.on("opentag", function (node) {
    //console.log("opentag", node.name, this._parser.line);
    //Skip node if it contains nullFlavor attribute
    if (true /*!node.attributes.nullFlavor*/ ) {
        //Peek item from top of stack
        var doc = _.last(proto.control);
        //Trying to get processing handler
        if (doc) {
            var self = doc.entity.obj();
            var handler = self[node.name];
            if (handler) {
                handler.call(self, node); //Process node
            } else {
                if (!node.isSelfClosing && !self[node.name + '$']) {
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

saxStream.on("closetag", function (tagname) {
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
saxStream.on("attribute", function (node) {
  console.log("attribute", node);
});*/

//Collect tag's text if any
saxStream.on("text", function (node) {
    //console.log("text", node);
    text = node;
});

//We are done, print result
saxStream.on("end", function () {
    //console.timeEnd('sax'); //Done, check the time
    //console.log(proto.control.length);
    //console.log(JSON.stringify(makeTransactionalBundle(last.get(), 'http://localhost:8080/fhir/base'), null, ' '));
});

//No work yet done before this point, just definitions
//console.time('sax');

var Transform = require("stream").Transform;
var util = require("util");

function CcdaParserStream() {
    Transform.call(this, {
        "objectMode": true
    }); // invoke Transform's constructor, expected result is object
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
    saxStream.write(line);
    cb();
};

/**
 * @Function _flush
 * Define standart Transform Stream's function _flush
 * Normally in should push parsed result (or error) to a pipe
 * @param cb - callback to notify that we are done
 */
CcdaParserStream.prototype._flush = function (cb) {
    this.push(last.get());
    cb();
};

//Just create a copy of input file while producing data organized in a bundle
//fs.createReadStream(__dirname + '/test/artifacts/bluebutton-01-original.xml')
//    .pipe(new CcdaParserStream())
//    .pipe(fs.createWriteStream("file-copy.xml"));

module.exports = CcdaParserStream;
