using SpacefarerService as service from '../../srv/spacefarer-service';
annotate service.Spacefarers with @(
    // Responsive-table grouping uses the same eligible properties as sorting.
    Capabilities.SortRestrictions.NonSortableProperties : [
        ID, email, originPlanet_ID, department_ID, position_ID
    ],
    Capabilities.NavigationRestrictions.RestrictedProperties : [
        { NavigationProperty : originPlanet, SortRestrictions : { Sortable : false } },
        {
            NavigationProperty : department,
            SortRestrictions : {
                NonSortableProperties : [department.ID, department.description, department.hqPlanet_ID]
            }
        },
        {
            NavigationProperty : position,
            SortRestrictions : {
                NonSortableProperties : [position.ID, position.description, position.salary]
            }
        }
    ],
    // Group headers need category text even when its column is not displayed.
    UI.PresentationVariant : {
        Visualizations : ['@UI.LineItem'],
        RequestAtLeast : [department.name, position.name, navigationSkill, navigationSkillText]
    },
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'Spacefarer Name',
                Value : name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'E-mail',
                Value : email,
            },
            {
                $Type : 'UI.DataField',
                Value : originPlanet.name,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'Personal Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Employment Information',
            ID : 'EmploymentInformation',
            Target : '@UI.FieldGroup#EmploymentInformation',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Navigation & Training',
            ID : 'NavigationTraining',
            Target : '@UI.FieldGroup#NavigationTraining',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Equipment & Resources',
            ID : 'EquipmentResources',
            Target : '@UI.FieldGroup#EquipmentResources',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'Spacefarer',
            Value : name,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Stardust',
            Value : stardust,
        },
        {
            $Type : 'UI.DataField',
            Value : suitColor,
            Label : 'Suit Color',
        },
    ],
    UI.SelectionFields : [
        suitColor,
    ],
    UI.HeaderInfo : {
        Title : {
            $Type : 'UI.DataField',
            Value : name,
        },
        TypeName : '',
        TypeNamePlural : '',
    },
    UI.FieldGroup #NavigationTraining : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : navigationSkill,
            },
            {
                $Type : 'UI.DataField',
                Value : trialTimeMinutes,
                Label : 'Trial Duration (minutes)',
            },
        ],
    },
    UI.FieldGroup #EquipmentResources : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : stardust,
                Label : 'Stardust',
            },
            {
                $Type : 'UI.DataField',
                Value : suitColor,
            },
        ],
    },
    UI.FieldGroup #EmploymentInformation : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : department_ID,
                Label : 'Department',
            },
            {
                $Type : 'UI.DataField',
                Value : department.name,
                Label : 'Department Name',
            },
            {
                $Type : 'UI.DataField',
                Value : department.description,
                Label : 'Department Description',
            },
            {
                $Type : 'UI.DataField',
                Value : department.hqPlanet.name,
                Label : 'Department HQ',
            },
            {
                $Type : 'UI.DataField',
                Value : position_ID,
                Label : 'Position',
            },
            {
                $Type : 'UI.DataField',
                Value : position.name,
                Label : 'Position Name',
            },
            {
                $Type : 'UI.DataField',
                Value : position.description,
                Label : 'Position Description',
            },
            {
                $Type : 'UI.DataField',
                Value : position.salary,
                Label : 'Salary',
            },
        ],
    },
);

annotate service.Spacefarers with {
    originPlanet @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Planets',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : originPlanet_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
        ],
    }
};

annotate service.Spacefarers with {
    // CAP propagates managed-association annotations to department_ID.
    department @(
      Common.Label : 'Department',
      Common.Text : department.name,
      Common.TextArrangement : #TextOnly,
      Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Departments',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : department_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
        ],
      }
    )
};

annotate service.Spacefarers with {
    position @(
      Common.Label : 'Position',
      Common.Text : position.name,
      Common.TextArrangement : #TextOnly,
      Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Positions',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : position_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'description',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'salary',
            },
        ],
      }
    )
};

annotate service.Spacefarers with @(
    Common.SideEffects #Department : {
        SourceProperties : [department_ID],
        TargetEntities : [department],
    },
    Common.SideEffects #Position : {
        SourceProperties : [position_ID],
        TargetEntities : [position],
    }
);

annotate service.Departments with {
    ID @(Common.Text : name, Common.TextArrangement : #TextOnly);
    name @Common.Label : 'Department';
};

annotate service.Positions with {
    ID @(Common.Text : name, Common.TextArrangement : #TextOnly);
    name @Common.Label : 'Position';
};

annotate service.Spacefarers with {
    ID @UI.Hidden;
    name @Common.Label : 'Spacefarer';
    email @Common.Label : 'E-mail';
    stardust @Common.Label : 'Stardust';
    originPlanet @Common.Label : 'Origin Planet';
    trialTimeMinutes @Common.Label : 'Trial Duration (minutes)';
    // TextOnly columns sort and group by their text property in Fiori V4.
    navigationSkillText @Common.Label : 'Navigation Skill';
    suitColorText @Common.Label : 'Suit Color';
};

annotate service.Planets with {
    name @(
        Common.Label : 'Origin Planet',
        )
};

annotate service.Spacefarers with {
    navigationSkill @(
        Common.Label : 'Navigation Skill',
        Common.Text : navigationSkillText,
        Common.TextArrangement : #TextOnly
    )
};

annotate service.Spacefarers with {
    suitColor @(
        Common.Label : 'Suit Color',
        Common.Text : suitColorText,
        Common.TextArrangement : #TextOnly,
        Common.ValueListWithFixedValues : true,
        Common.ValueList : {
            $Type : 'Common.ValueListType',
            Label : 'Suit Color',
            CollectionPath : 'SuitColors',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : suitColor,
                    ValueListProperty : 'code',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'name',
                },
            ],
        }
    )
};

annotate service.SuitColors with {
    code @(
        Common.Text : name,
        Common.TextArrangement : #TextOnly
    )
};

annotate service.Spacefarers with {
  name             @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  email            @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  navigationSkill  @Common.FieldControl: #ReadOnly;
  trialTimeMinutes @Common.FieldControl: #ReadOnly;
  originPlanet     @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 3] } };
  department       @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 7] } };
  position         @Common.FieldControl: { $edmJson: { $If: [{ $Path: 'HasActiveEntity' }, 1, 7] } };
};
