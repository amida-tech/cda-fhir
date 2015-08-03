/* jshint -W003 */
/* jshint -W040 */
/// <reference path="./typings/node/node.d.ts"/>
/// <reference path="./typings/mocha/mocha.d.ts"/>
/// <reference path="./typings/lodash/lodash.d.ts" />

"use strict";

//TODO process substanceAdministration/performer
// Startup file for debugging
var fs = require('fs');
var _ = require("lodash");

var getResource = function (resType, init) {
    var res = {
        'resource': {
            'resourceType': resType
        }
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
    if (date && date.length === 8) {
        return date.substr(0, 4) + '-' + date.substr(4, 2) + '-' + date.substr(6, 2);
    } else {
        return date;
    }
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
        ensureProperty.call(organization, 'telecom', true).push({
            'use': node.attributes.use,
            'value': node.attributes.value
        });
    };

    this.addr = function (node) {
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }
        var address = {
            'use': node.attributes.use
        };
        ensureProperty.call(organization, 'address', true).push(address);

        proto.control.push(new Triplet(node, new Addr(address)));
    };

};
Organization.prototype = proto;

/**
 * AKA assignedAuthor
 */
var AssignedEntity = function (practitioner) {
    var _practitioner = practitioner;

    this.addr = function (node) {
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }
        var address = {
            'use': node.attributes.use
        };
        ensureProperty.call(_practitioner, 'address', true).push(address);

        proto.control.push(new Triplet(node, new Addr(address)));
    };

    this.telecom = function (node) {
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }
        ensureProperty.call(_practitioner, 'telecom', true).push({
            'use': node.attributes.use,
            'value': node.attributes.value
        });
    };

    this.representedOrganization = function (node) {
        var organization = {
            'resourceType': 'Organization',
            'id': 'Organization/' + (serial++).toString()
        };
        _practitioner.managingOrganization = {
            'reference': +organization.id
        };
        proto.bundle.entry.push({
            'resource': organization
        });
        ensureProperty.call(_practitioner, 'practitionerRole', true).push({
            'managingOrganization': {
                'reference': organization.id
            }
        });
        proto.control.push(new Triplet(node, new Organization(organization)));
    };

    this.assignedPerson = function (node) {
        if (node.attributes.nullFlavor === 'UNK') {
            return;
        }

        proto.control.push(new Triplet(node, new AssignedPerson(_practitioner)));
    };
};
AssignedEntity.prototype = proto;

var Performer = function (resource) {
    var patient = findPatient(proto.bundle);

    switch (resource.resourceType) {
    case 'MedicationAdministration':
        var medicationAdministration = resource;
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
                medicationAdministration.practitioner = {
                    'reference': practitioner.id
                };
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner)));
            }
        };
        this._self.prototype = proto;
        break;
    case 'Immunization':
        var immunization = resource;
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
                immunization.performer = {
                    'reference': practitioner.id
                };
                proto.control.push(new Triplet(node, new AssignedEntity(practitioner)));
            }
        };
        this._self.prototype = proto;
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

var ParticipantRole = function (resource) {

    this.playingEntity = function (node) {
        proto.control.push(new Triplet(node, new PlayingEntity(resource)));
    };

    this.playingDevice = function (node) {
        proto.control.push(new Triplet(node, new PlayingDevice(resource)));
    };
};
ParticipantRole.prototype = proto;

var Participant = function (resource) {

    this.participantRole = function (node) {
        proto.control.push(new Triplet(node, new ParticipantRole(resource)));
    };

};
Participant.prototype = proto;

var Observation = function (typeCode, resource, param1, bundle, composition) {
    var templateId = [];
    var familyMemberHistory;
    var clinicalImpression;
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

            /*case '2.16.840.1.113883.10.20.22.4.2': // conforms to Result observation
            case '2.16.840.1.113883.10.20.22.4.67': // Functional status result observation
                switch( resource.resourceType) {
                      case 'ClinicalImpression' :
                      clinicalImpression = resource; 
                        this._self = {
                                code : function(node) {
                                    var investigation = {'code': makeCode(node)};
                                    ensureProperty.call(clinicalImpression,'investigations').push(investigation);
                                     
                                },
                                statusCode : function(node) {
                                    clinicalImpression.status = node.attributes.statusCode;
                                },
                                effectiveTime : function(node) {
                                    clinicalImpression.date = dateFix(node.attributes.value);
                                },
                                entryRelationship: function(node) {
                                    proto.control.push(new Triplet(node, new EntryRelationship(node.attributes.typeCode, clinicalImpression), templateId));
                                }
                        };
                    break;
                }
                this._self.prototype = proto;
                break;

            case '2.16.840.1.113883.10.20.22.4.69': // Assessment scale observation
            clinicalImpression = resource; 
                this._self = {
                    code : function(node) {
                    ensureProperty.call(clinicalImpression,'investigations').push(investigation);                    
                    }
                };
                this._self.prototype = proto;
                break;*/
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

        proto.control.push(new Triplet(node, new Observation(typeCode, condition, null)));
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
        proto.control.push(new Triplet(node, new Observation(typeCode, allergyIntolerance, allergyIntolerance.event[0])));
    };

};
EntryRelationshipAllergyIntolerance.prototype = proto;

var EntryRelationship = function (typeCode, resource) {

    this.observation = function (node) {
        proto.control.push(new Triplet(node, new Observation(typeCode, resource)));
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
        if (resource) {
            var familyHistoryOrganizer = '2.16.840.1.113883.10.20.22.4.45';
            if (_.contains(templateId, familyHistoryOrganizer) || isInContextOf(familyHistoryOrganizer)) { //Family history organizer
                proto.control.push(new Triplet(node, new Component(resource), templateId));
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
        var patient = findPatient(proto.bundle);
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
    };

    //Part of FAIMLY HSTORY
    this.organizer = function (node) {
        proto.control.push(new Triplet(node, new Organizer(), templateId));
    };

    this.supply = function (node) {
        proto.control.push(new Triplet(node, new Supply(resource), templateId));
    };

};
Entry.prototype = proto;

var Section = function (resource) {
    var templateId = [];

    this.entry = function (node) {
        proto.control.push(new Triplet(node, new Entry(resource), templateId));
    };

    this.templateId = function (node) {
        templateId.push(node.attributes.root);
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
        proto.control.push(new Triplet(node, new Observation(null, resource, {})));
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
        ensureProperty.call(contact, 'telecom', true).push({
            'use': node.attributes.use,
            'value': node.attributes.value
        });
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
            'use': node.attributes.use
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
        _patient.telecom.push({
            'use': node.attributes.use,
            'value': node.attributes.value
        });
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
    //console.log("opentag", node.name);
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
    console.timeEnd('sax'); //Done, check the time
    //console.log(proto.control.length);
    console.log(JSON.stringify(makeTransactionalBundle(last.get(), 'http://localhost:8080/fhir/base'), null, ' '));
});

//No work yet done before this point, just definitions
console.time('sax');

//Just create a copy of input file while producing data organized in a bundle 
fs.createReadStream(__dirname + '/test/artifacts/bluebutton-01-original.xml')
    .pipe(saxStream)
    .pipe(fs.createWriteStream("file-copy.xml"));
